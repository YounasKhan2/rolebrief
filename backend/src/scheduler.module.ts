import { Module } from "@nestjs/common";
import { AppConfigModule } from "./common/config/app-config.module";
import { LoggingModule } from "./common/logging/logging.module";
import { QueueModule } from "./queue/queue.module";
import { PrismaModule } from "./prisma/prisma.module";
import { HimalayasSchedulerService } from "./scheduler/himalayas-scheduler.service";
import { AlertDigestSchedulerService } from "./scheduler/alert-digest-scheduler.service";

@Module({
  imports: [AppConfigModule, LoggingModule, QueueModule, PrismaModule],
  providers: [HimalayasSchedulerService, AlertDigestSchedulerService],
  exports: [AlertDigestSchedulerService]
})
export class SchedulerModule {}
