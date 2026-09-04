import { Module } from "@nestjs/common";
import { AppConfigModule } from "./common/config/app-config.module";
import { LoggingModule } from "./common/logging/logging.module";
import { QueueModule } from "./queue/queue.module";

@Module({
  imports: [AppConfigModule, LoggingModule, QueueModule]
})
export class SchedulerModule {}
