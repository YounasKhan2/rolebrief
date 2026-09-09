import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { RateLimitModule } from "../../common/rate-limit/rate-limit.module";
import { AppConfigModule } from "../../common/config/app-config.module";
import { QueueModule } from "../../queue/queue.module";
import { AlertsController } from "./alerts.controller";
import { AlertsService } from "./alerts.service";
import { JobOutboxDispatcherService } from "./job-outbox-dispatcher.service";

@Module({
 imports: [PrismaModule, RateLimitModule, AppConfigModule, QueueModule],
 controllers: [AlertsController],
 providers: [AlertsService, JobOutboxDispatcherService],
 exports: [AlertsService, JobOutboxDispatcherService]
})
export class AlertsModule {}
