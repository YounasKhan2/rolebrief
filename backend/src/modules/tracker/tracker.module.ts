import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AppConfigModule } from "../../common/config/app-config.module";
import { RateLimitModule } from "../../common/rate-limit/rate-limit.module";
import { JobsModule } from "../jobs/jobs.module";
import { TrackerController } from "./tracker.controller";
import { TrackerService } from "./tracker.service";
import { TrackerRateLimitGuard } from "./tracker-rate-limit.guard";

@Module({
  imports: [PrismaModule, AppConfigModule, JobsModule, RateLimitModule],
  controllers: [TrackerController],
  providers: [TrackerService, TrackerRateLimitGuard],
  exports: [TrackerService]
})
export class TrackerModule {}
