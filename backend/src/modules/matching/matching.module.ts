import { Module } from "@nestjs/common";
import { CsrfGuard } from "../../auth/csrf.guard";
import { AppConfigModule } from "../../common/config/app-config.module";
import { RateLimitModule } from "../../common/rate-limit/rate-limit.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { MatchBriefEvaluatorService } from "./match-brief-evaluator.service";
import { MatchBriefBatchRateLimitGuard, MatchBriefDetailRateLimitGuard } from "./match-brief-rate-limit.guard";
import { MatchBriefsController } from "./match-briefs.controller";
import { MatchBriefsService } from "./match-briefs.service";

@Module({
  imports: [AppConfigModule, PrismaModule, RateLimitModule],
  controllers: [MatchBriefsController],
  providers: [
    MatchBriefsService,
    MatchBriefEvaluatorService,
    MatchBriefBatchRateLimitGuard,
    MatchBriefDetailRateLimitGuard,
    CsrfGuard
  ],
  exports: [MatchBriefsService, MatchBriefEvaluatorService]
})
export class MatchingModule {}
