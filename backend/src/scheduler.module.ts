import { Module } from "@nestjs/common";
import { AppConfigModule } from "./common/config/app-config.module";
import { LoggingModule } from "./common/logging/logging.module";
import { QueueModule } from "./queue/queue.module";
import { HimalayasSchedulerService } from "./scheduler/himalayas-scheduler.service";

@Module({
  imports: [AppConfigModule, LoggingModule, QueueModule],
  providers: [HimalayasSchedulerService]
})
export class SchedulerModule {}
