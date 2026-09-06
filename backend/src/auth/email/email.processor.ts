import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { EmailDeliveryStatus } from "@prisma/client";
import { Job, UnrecoverableError } from "bullmq";
import { AppConfigService } from "../../common/config/app-config.service";
import { PrismaService } from "../../prisma/prisma.service";
import { QUEUES, SEND_AUTH_EMAIL_JOB } from "../../queue/queue.constants";
import { buildAuthEmail } from "./email.templates";
import { FakeEmailProvider } from "./fake-email.provider";
import { ResendEmailProvider } from "./resend.provider";
import { EmailProvider, EmailProviderError, EmailTemplate } from "./email.types";

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

    const data = job.data as { deliveryId?: string; token?: string };
    if (!data.deliveryId) throw new UnrecoverableError("Missing delivery id.");

    const delivery = await this.prisma.emailDelivery.findUnique({ where: { id: data.deliveryId } });
    if (!delivery) throw new UnrecoverableError("Delivery record not found.");
    if (delivery.status === EmailDeliveryStatus.SENT || delivery.status === EmailDeliveryStatus.DELIVERED) {
      return { sent: false, reason: "already_sent" };
    }

    const template = delivery.template as EmailTemplate;
    const message = buildAuthEmail({
      template,
      to: delivery.toEmail,
      token: data.token,
      frontendOrigin: this.config.auth.frontendOrigin,
      replyTo: this.config.auth.email.replyTo
    });

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

  private provider(): EmailProvider {
    return this.config.auth.email.provider === "resend" ? this.resendProvider : this.fakeProvider;
  }
}
