import { Injectable, Logger } from "@nestjs/common";
import { AppConfigService } from "../../common/config/app-config.service";

interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: AppConfigService) {}

  async sendVerification(email: string, token: string) {
    const link = `${this.config.auth.frontendOrigin}/verify-email?token=${encodeURIComponent(token)}`;
    await this.send({
      to: email,
      subject: "Verify your RoleBrief email",
      text: `Verify your RoleBrief account: ${link}`
    }, token);
  }

  async sendPasswordReset(email: string, token: string) {
    const link = `${this.config.auth.frontendOrigin}/reset-password?token=${encodeURIComponent(token)}`;
    await this.send({
      to: email,
      subject: "Reset your RoleBrief password",
      text: `Reset your RoleBrief password: ${link}`
    }, token);
  }

  async sendPasswordChanged(email: string) {
    await this.send({
      to: email,
      subject: "Your RoleBrief password changed",
      text: "Your RoleBrief password was changed. If this was not you, start password recovery immediately."
    });
  }

  private async send(message: EmailMessage, sensitiveToken?: string) {
    const provider = this.config.auth.email.provider;
    if (provider === "resend") {
      await this.sendWithResend(message);
      return;
    }

    if (provider === "dev" && this.config.nodeEnv === "development") {
      this.logger.log({
        event: "auth.email.dev",
        to: message.to,
        subject: message.subject,
        devLink: sensitiveToken ? message.text : undefined
      });
    } else if (provider === "dev") {
      this.logger.log({ event: "auth.email.fake", to: message.to, subject: message.subject });
    } else {
      this.logger.warn(`Email provider "${provider}" is not configured; email was not sent.`);
    }
  }

  private async sendWithResend(message: EmailMessage) {
    const { from, resendApiKey } = this.config.auth.email;
    if (!from || !resendApiKey) {
      throw new Error("Resend email requires EMAIL_FROM and RESEND_API_KEY.");
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text })
    });

    if (!response.ok) {
      const detail = await response.text();
      this.logger.error({ status: response.status, detail }, "Resend rejected the email");
      throw new Error(`Resend email failed with status ${response.status}.`);
    }
  }
}
