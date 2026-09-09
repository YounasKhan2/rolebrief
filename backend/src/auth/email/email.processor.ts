import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import {
  AlertChannel,
  AlertMatchEmailState,
  AlertStatus,
  EmailDeliveryStatus,
  JobStatus,
  UserStatus
} from "@prisma/client";
import { Job, UnrecoverableError } from "bullmq";
import { AppConfigService } from "../../common/config/app-config.service";
import { PrismaService } from "../../prisma/prisma.service";
import { QUEUES, SEND_AUTH_EMAIL_JOB } from "../../queue/queue.constants";
import { buildAlertDigestEmail, buildAlertMatchEmail, buildAuthEmail } from "./email.templates";
import { FakeEmailProvider } from "./fake-email.provider";
import { ResendEmailProvider } from "./resend.provider";
import { EmailMessage, EmailProvider, EmailProviderError, EmailTemplate } from "./email.types";

@Injectable()
@Processor(QUEUES.delivery)
export class EmailDeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailDeliveryProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly fakeProvider: FakeEmailProvider,
    private readonly resendProvider: ResendEmailProvider
  ) {
    super();
  }

  async process(job: Job) {
    if (job.name !== SEND_AUTH_EMAIL_JOB) {
      return { skipped: true, reason: `Unsupported delivery job ${job.name}` };
    }

    const data = job.data as { deliveryId?: string; token?: string; payload?: Record<string, unknown> };
    if (!data.deliveryId) throw new UnrecoverableError("Missing delivery id.");

    const delivery = await this.prisma.emailDelivery.findUnique({ where: { id: data.deliveryId } });
    if (!delivery) throw new UnrecoverableError("Delivery record not found.");
    if (delivery.status === EmailDeliveryStatus.SENT || delivery.status === EmailDeliveryStatus.DELIVERED) {
      return { sent: false, reason: "already_sent" };
    }

    const template = delivery.template as EmailTemplate;
    let message: EmailMessage;

    if (template === "alert-match") {
      const payload = data.payload as any;
      const alertId = (data as any).alertId || payload?.alertId;
      const jobId = (data as any).jobId || payload?.jobId;
      const matchRecordId = (data as any).matchRecordId || payload?.matchRecordId;

      // Pre-send Suppression Proof: Re-check latest User, Alert, Job, and AlertMatch
      if (delivery.userId) {
        const user = await this.prisma.user.findUnique({ where: { id: delivery.userId } });
        if (!user || user.status !== UserStatus.ACTIVE) {
          await this.suppressDelivery(delivery.id, matchRecordId, "User inactive or deleted");
          return { sent: false, suppressed: true, reason: "user_inactive_or_deleted" };
        }
      }

      if (alertId) {
        const alert = await this.prisma.alert.findUnique({ where: { id: alertId } });
        if (!alert || alert.status !== AlertStatus.ACTIVE) {
          await this.suppressDelivery(delivery.id, matchRecordId, "Alert paused or deleted");
          return { sent: false, suppressed: true, reason: "alert_paused_or_deleted" };
        }
        if (alert.channel !== AlertChannel.EMAIL && alert.channel !== AlertChannel.BOTH) {
          await this.suppressDelivery(delivery.id, matchRecordId, "Alert email channel disabled");
          return { sent: false, suppressed: true, reason: "alert_email_channel_disabled" };
        }
      }

      if (jobId) {
        const targetJob = await this.prisma.job.findUnique({
          where: { id: jobId },
          include: { source: true, occurrences: true }
        });
        const now = new Date();
        const isExpired = Boolean(
          !targetJob ||
          targetJob.status === JobStatus.EXPIRED ||
          targetJob.status === JobStatus.SUSPICIOUS ||
          (targetJob.expiresAt && targetJob.expiresAt <= now) ||
          (targetJob.applicationDeadlineAt && targetJob.applicationDeadlineAt <= now)
        );

        const hasApplyUrl = Boolean(
          targetJob?.occurrences?.some((o) => Boolean(o.applicationUrl || o.sourceUrl)) ||
          targetJob?.source?.baseUrl
        );

        if (isExpired || !hasApplyUrl) {
          await this.suppressDelivery(delivery.id, matchRecordId, "Job expired, delisted, suspicious, or missing application link");
          return { sent: false, suppressed: true, reason: "job_expired_or_invalid" };
        }
      }

      message = buildAlertMatchEmail({
        to: delivery.toEmail,
        alertName: payload.alertName,
        role: payload.role,
        unsubscribeUrl: payload.unsubscribeUrl,
        replyTo: this.config.auth.email.replyTo
      });
    } else if (template === "alert-digest") {
      const payload = data.payload as any;
      const alertId = (data as any).alertId || payload?.alertId;

      // Pre-send Suppression Proof: Re-check latest User and Alert
      if (delivery.userId) {
        const user = await this.prisma.user.findUnique({ where: { id: delivery.userId } });
        if (!user || user.status !== UserStatus.ACTIVE) {
          await this.suppressDelivery(delivery.id, undefined, "User inactive or deleted");
          return { sent: false, suppressed: true, reason: "user_inactive_or_deleted" };
        }
      }

      if (alertId) {
        const alert = await this.prisma.alert.findUnique({ where: { id: alertId } });
        if (!alert || alert.status !== AlertStatus.ACTIVE) {
          await this.suppressDelivery(delivery.id, undefined, "Alert paused or deleted");
          return { sent: false, suppressed: true, reason: "alert_paused_or_deleted" };
        }
        if (alert.channel !== AlertChannel.EMAIL && alert.channel !== AlertChannel.BOTH) {
          await this.suppressDelivery(delivery.id, undefined, "Alert email channel disabled");
          return { sent: false, suppressed: true, reason: "alert_email_channel_disabled" };
        }
      }

      message = buildAlertDigestEmail({
        to: delivery.toEmail,
        alertName: payload.alertName,
        roles: payload.roles,
        unsubscribeUrl: payload.unsubscribeUrl,
        replyTo: this.config.auth.email.replyTo
      });
    } else {
      message = buildAuthEmail({
        template,
        to: delivery.toEmail,
        token: data.token,
        frontendOrigin: this.config.auth.frontendOrigin,
        replyTo: this.config.auth.email.replyTo
      });
    }

    await this.prisma.emailDelivery.update({
      where: { id: delivery.id },
      data: { attempts: { increment: 1 }, lastAttemptAt: new Date(), status: EmailDeliveryStatus.QUEUED }
    });

    try {
      const result = await this.provider().send(message, delivery.dedupeKey);
      await this.prisma.emailDelivery.update({
        where: { id: delivery.id },
        data: {
          status: EmailDeliveryStatus.SENT,
          sentAt: new Date(),
          providerMessageId: result.messageId,
          failureCode: null,
          failureType: null
        }
      });
      return { sent: true, deliveryId: delivery.id };
    } catch (error) {
      const providerError = error instanceof EmailProviderError ? error : new EmailProviderError("Email delivery failed.", "email_unknown", true);
      await this.prisma.emailDelivery.update({
        where: { id: delivery.id },
        data: {
          status: EmailDeliveryStatus.FAILED,
          failedAt: new Date(),
          failureCode: providerError.code,
          failureType: providerError.temporary ? "temporary" : "permanent"
        }
      });
      this.logger.warn({ event: "auth.email.delivery_failed", deliveryId: delivery.id, code: providerError.code, temporary: providerError.temporary });
      if (!providerError.temporary) throw new UnrecoverableError(providerError.message);
      throw providerError;
    }
  }

  private async suppressDelivery(deliveryId: string, matchRecordId: string | undefined, reason: string): Promise<void> {
    this.logger.log(`Suppressing email delivery ${deliveryId}: ${reason}`);
    await this.prisma.emailDelivery.update({
      where: { id: deliveryId },
      data: {
        status: EmailDeliveryStatus.FAILED,
        failureCode: "suppressed",
        failureType: "permanent"
      }
    }).catch(() => undefined);

    if (matchRecordId && this.prisma.alertMatch) {
      await this.prisma.alertMatch.update({
        where: { id: matchRecordId },
        data: {
          emailState: AlertMatchEmailState.SUPPRESSED,
          suppressionReason: reason
        }
      }).catch(() => undefined);
    }
  }

  private provider(): EmailProvider {
    return this.config.auth.email.provider === "resend" ? this.resendProvider : this.fakeProvider;
  }
}
