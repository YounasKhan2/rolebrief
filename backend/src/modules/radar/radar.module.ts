import { Module } from "@nestjs/common";
import { AppConfigModule } from "../../common/config/app-config.module";
import { RateLimitModule } from "../../common/rate-limit/rate-limit.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { EligibilityModule } from "../eligibility/eligibility.module";
import { JobsModule } from "../jobs/jobs.module";
import { MatchingModule } from "../matching/matching.module";
import { RadarCacheService } from "./radar-cache.service";
import { RadarController } from "./radar.controller";
import { RadarQueryService } from "./radar-query.service";
import { RadarRankingService } from "./radar-ranking.service";
import { RadarRateLimitGuard } from "./radar-rate-limit.guard";
import { RadarService } from "./radar.service";

@Module({
  imports: [AppConfigModule, PrismaModule, JobsModule, MatchingModule, EligibilityModule, RateLimitModule],
  controllers: [RadarController],
  providers: [RadarService, RadarQueryService, RadarRankingService, RadarCacheService, RadarRateLimitGuard],
  exports: [RadarService]
})
export class RadarModule {}
