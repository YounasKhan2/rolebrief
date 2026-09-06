import { Module } from "@nestjs/common";
import { AppConfigModule } from "../../common/config/app-config.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { QueueModule } from "../../queue/queue.module";
import { EmailService } from "./email.service";
import { FakeEmailProvider } from "./fake-email.provider";
import { ResendEmailProvider } from "./resend.provider";

@Module({
  imports: [AppConfigModule, PrismaModule, QueueModule],
  providers: [EmailService, FakeEmailProvider, ResendEmailProvider],
  exports: [EmailService, FakeEmailProvider, ResendEmailProvider]
})
export class EmailModule {}
