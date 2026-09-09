import { Module } from "@nestjs/common";
import { AppConfigModule } from "../../common/config/app-config.module";
import { RateLimitModule } from "../../common/rate-limit/rate-limit.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { EligibilityController } from "./eligibility.controller";
import { EligibilityEvaluatorService } from "./eligibility-evaluator.service";
import {
  EligibilityBatchRateLimitGuard,
  EligibilityDetailRateLimitGuard
} from "./eligibility-rate-limit.guard";
import { EligibilityService } from "./eligibility.service";
import { TimezoneResolverService } from "./timezone-resolver.service";

@Module({
  imports: [PrismaModule, AppConfigModule, RateLimitModule],
  controllers: [EligibilityController],
  providers: [
    EligibilityService,
    EligibilityEvaluatorService,
    TimezoneResolverService,
    EligibilityBatchRateLimitGuard,
    EligibilityDetailRateLimitGuard
  ],
  exports: [EligibilityService, EligibilityEvaluatorService]
})
export class EligibilityModule {}
