import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { EmailDeliveryStatus, Prisma } from "@prisma/client";
import { Queue } from "bullmq";
import { createHash } from "crypto";
import { AppConfigService } from "../../common/config/app-config.service";
import { PrismaService } from "../../prisma/prisma.service";
import { QUEUES, SEND_AUTH_EMAIL_JOB } from "../../queue/queue.constants";
import { buildAuthEmail } from "./email.templates";
import { EmailTemplate } from "./email.types";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    @InjectQueue(QUEUES.delivery) private readonly deliveryQueue: Queue
  ) {}

  sendVerification(userId: string, email: string, tokenId: string, token: string) {
    return this.enqueue({ userId, email, tokenId, token, template: "verify-email" });
  }

  sendPasswordReset(userId: string, email: string, tokenId: string, token: string) {
    return this.enqueue({ userId, email, tokenId, token, template: "reset-password" });
  }

  sendPasswordChanged(userId: string, email: string) {
    return this.enqueue({ userId, email, tokenId: "password-changed", template: "password-changed" });
  }

  private async enqueue(input: { userId: string; email: string; template: EmailTemplate; tokenId: string; token?: string }) {
    if (!this.config.auth.email.deliveryEnabled) {
      this.logger.warn({ event: "auth.email.delivery_disabled", template: input.template, userId: input.userId });
      return { queued: false };
    }

    const message = buildAuthEmail({
      template: input.template,
      to: input.email,
      token: input.token,
      frontendOrigin: this.config.auth.frontendOrigin,
      replyTo: this.config.auth.email.replyTo
    });
    const dedupeKey = this.dedupeKey(input.template, input.userId, input.tokenId);
    const delivery = await this.prisma.emailDelivery.upsert({
      where: { dedupeKey },
      create: {
        userId: input.userId,
        toEmail: input.email,
        template: input.template,
        subject: message.subject,
        provider: this.config.auth.email.provider,
        dedupeKey,
        status: EmailDeliveryStatus.QUEUED
      },
      update: {}
    });

    await this.deliveryQueue.add(
      SEND_AUTH_EMAIL_JOB,
      { deliveryId: delivery.id, token: input.token },
      {
        jobId: delivery.id,
        attempts: 4,
        backoff: { type: "exponential", delay: 30_000 },
        removeOnComplete: 1000,
        removeOnFail: 1000
      }
    );
    return { queued: true, deliveryId: delivery.id };
  }

  private dedupeKey(template: EmailTemplate, userId: string, tokenId: string) {
    return createHash("sha256").update(`${template}:${userId}:${tokenId}`).digest("hex");
  }
}
