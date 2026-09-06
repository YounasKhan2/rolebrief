import { Injectable } from "@nestjs/common";
import { AppConfigService } from "../../common/config/app-config.service";
import { EmailMessage, EmailProvider, EmailProviderError, EmailProviderResult } from "./email.types";

@Injectable()
export class ResendEmailProvider implements EmailProvider {
  constructor(private readonly config: AppConfigService) {}

  async send(message: EmailMessage, dedupeKey: string): Promise<EmailProviderResult> {
    const { resendApiKey, from, replyTo } = this.config.auth.email;
    if (!resendApiKey || !from) {
      throw new EmailProviderError("Resend email is not configured.", "resend_configuration_missing", false);
    }

    let response: Response;
    try {
      response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": dedupeKey
        },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
          reply_to: message.replyTo || replyTo || undefined
        })
      });
    } catch {
      throw new EmailProviderError("Resend request failed.", "resend_network_error", true);
    }

    if (!response.ok) {
      const temporary = response.status === 429 || response.status >= 500 || response.status === 408;
      throw new EmailProviderError("Resend rejected the email.", `resend_${response.status}`, temporary);
    }

    const body = await response.json().catch(() => ({})) as { id?: string };
    return { messageId: body.id };
  }
}
