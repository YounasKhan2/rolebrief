import { Injectable, Logger } from "@nestjs/common";
import { AppConfigService } from "../../common/config/app-config.service";
import { redactEmail } from "../auth.utils";
import { EmailMessage, EmailProvider, EmailProviderResult } from "./email.types";

@Injectable()
export class FakeEmailProvider implements EmailProvider {
  private readonly logger = new Logger(FakeEmailProvider.name);

  constructor(private readonly config: AppConfigService) {}

  async send(message: EmailMessage): Promise<EmailProviderResult> {
    const event = { event: "auth.email.fake", to: redactEmail(message.to), subject: message.subject };
    if (this.config.auth.email.exposeDevLinks && this.config.nodeEnv === "development") {
      this.logger.log({ ...event, devBody: message.text });
    } else {
      this.logger.log(event);
    }
    return { messageId: `fake_${Date.now()}` };
  }
}
