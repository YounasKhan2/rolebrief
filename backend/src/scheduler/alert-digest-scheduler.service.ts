import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import {
  AlertCadence,
  AlertChannel,
  AlertMatchEmailState,
  AlertStatus,
  EmailDeliveryStatus
} from "@prisma/client";
import { Queue } from "bullmq";
import { createHash } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AppConfigService } from "../common/config/app-config.service";
import { QUEUES, SEND_AUTH_EMAIL_JOB } from "../queue/queue.constants";
import { generateAlertUnsubscribeToken } from "../modules/alerts/alert-unsubscribe.util";

@Injectable()
export class AlertDigestSchedulerService {
  private readonly logger = new Logger(AlertDigestSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    @InjectQueue(QUEUES.delivery) private readonly deliveryQueue: Queue
  ) {}

  async processDigests(currentHourUtc: number = new Date().getUTCHours(), currentDayOfWeek: number = new Date().getUTCDay()) {
    if (!this.config.auth.email.deliveryEnabled) {
      return { sent: 0, reason: "email_delivery_disabled" };
    }

    // 1. Query active alerts due for daily or weekly digest delivery at this UTC hour
    const alerts = await this.prisma.alert.findMany({
      where: {
        status: AlertStatus.ACTIVE,
        deliveryHourUtc: currentHourUtc,
        OR: [
          { cadence: AlertCadence.DAILY },
          { cadence: AlertCadence.WEEKLY, deliveryDayOfWeek: currentDayOfWeek }
        ],
        channel: { in: [AlertChannel.EMAIL, AlertChannel.BOTH] }
      },
      include: {
        user: true,
        matches: {
          where: {
            emailState: AlertMatchEmailState.PENDING
          },
          include: {
            job: {
              include: {
                company: true,
                salaries: true
              }
            }
          },
          take: 20
        }
      }
    });

    let sentCount = 0;

    for (const alert of alerts) {
      if (alert.matches.length === 0) {
        continue;
      }

      try {
        const roles = alert.matches.map((m) => {
          const salary = m.job.salaries?.[0];
          const salaryText = salary
            ? `${salary.currency ?? "$"}${salary.min?.toLocaleString() ?? ""}${salary.max ? ` - ${salary.max.toLocaleString()}` : ""} ${salary.period ?? ""}`.trim()
            : undefined;

          return {
            title: m.job.canonicalTitle,
            companyName: m.job.company?.canonicalName ?? "Unknown",
            workMode: m.job.workMode,
            locationsText: m.job.remoteCountryCodes?.join(", "),
            salaryText,
            eligibilityStatus: m.eligibilityStatus ?? undefined,
            viewUrl: `${this.config.auth.frontendOrigin}/app/jobs/${m.job.slug}`
          };
        });

        const unsubscribeToken = generateAlertUnsubscribeToken(
          alert.id,
          alert.userId,
          this.config.cursorSigningSecret,
          "pause"
        );
        const unsubscribeUrl = `${this.config.publicAppUrl}/api/v1/alerts/unsubscribe/${unsubscribeToken}`;

        const payload = {
          alertName: alert.name,
          roles,
          unsubscribeUrl
        };

        const dateStr = new Date().toISOString().slice(0, 10);
        const dedupeKey = createHash("sha256")
          .update(`alert-digest:${alert.id}:${dateStr}`)
          .digest("hex");

        const delivery = await this.prisma.emailDelivery.upsert({
          where: { dedupeKey },
          create: {
            userId: alert.userId,
            toEmail: alert.user.email,
            template: "alert-digest",
            subject: `Digest: ${roles.length} new roles for ${alert.name}`,
            provider: this.config.auth.email.provider,
            dedupeKey,
            status: EmailDeliveryStatus.QUEUED
          },
          update: {}
        });

        await this.deliveryQueue.add(
          SEND_AUTH_EMAIL_JOB,
          {
            deliveryId: delivery.id,
            alertId: alert.id,
            payload
          },
          {
            jobId: delivery.id,
            attempts: 4,
            backoff: { type: "exponential", delay: 30_000 },
            removeOnComplete: 1000,
            removeOnFail: 1000
          }
        );

        // Mark matches as sent
        const matchIds = alert.matches.map((m) => m.id);
        await this.prisma.alertMatch.updateMany({
          where: { id: { in: matchIds } },
          data: {
            emailState: AlertMatchEmailState.SENT,
            emailDeliveryId: delivery.id
          }
        });

        await this.prisma.alert.update({
          where: { id: alert.id },
          data: { lastDeliveredAt: new Date() }
        });

        sentCount++;
      } catch (err: any) {
        this.logger.error(`Failed to process digest for alert ${alert.id}: ${err.message}`, err.stack);
      }
    }

    return { sent: sentCount };
  }
}
