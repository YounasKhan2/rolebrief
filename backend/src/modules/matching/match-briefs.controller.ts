import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards, ValidationPipe } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AuthenticatedUser, CurrentUser } from "../../auth/auth.decorators";
import { CsrfGuard } from "../../auth/csrf.guard";
import { UserRoleGuard } from "../../auth/user-role.guard";
import { JobSlugValidationPipe } from "../saved/saved.controller";
import { BatchMatchBriefDto } from "./dto/batch-match-brief.dto";
import { MatchBriefBatchRateLimitGuard, MatchBriefDetailRateLimitGuard } from "./match-brief-rate-limit.guard";
import { MatchBriefsService } from "./match-briefs.service";
import { MatchBriefDetail, MatchBriefSummary } from "./reason-codes";

@ApiTags("match-briefs")
@ApiBearerAuth()
@UseGuards(UserRoleGuard)
@Controller("match-briefs")
export class MatchBriefsController {
  constructor(private readonly matchBriefs: MatchBriefsService) {}

  @Post("batch")
  @HttpCode(HttpStatus.OK)
  @UseGuards(CsrfGuard, MatchBriefBatchRateLimitGuard)
  @ApiOperation({ summary: "Calculate deterministic Match Brief summaries for up to 50 job slugs" })
  @ApiResponse({ status: 200, description: "Match Brief summaries in request order" })
  @ApiResponse({ status: 400, description: "Validation error, duplicate slug, or limit exceeded" })
  @ApiResponse({ status: 401, description: "Authentication required" })
  @ApiResponse({ status: 403, description: "Forbidden for administrative accounts or failed CSRF validation" })
  @ApiResponse({ status: 429, description: "Rate limit exceeded" })
  async batch(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })) body: BatchMatchBriefDto
  ): Promise<MatchBriefSummary[]> {
    return this.matchBriefs.evaluateBatch(user.id, body.slugs);
  }

  @Get("jobs/:slug")
  @UseGuards(MatchBriefDetailRateLimitGuard)
  @ApiOperation({ summary: "Get a detailed deterministic Match Brief for one job" })
  @ApiResponse({ status: 200, description: "Match Brief detail with bounded evidence" })
  @ApiResponse({ status: 400, description: "Invalid job slug format" })
  @ApiResponse({ status: 401, description: "Authentication required" })
  @ApiResponse({ status: 403, description: "Forbidden for administrative accounts" })
  @ApiResponse({ status: 404, description: "Job not found" })
  @ApiResponse({ status: 429, description: "Rate limit exceeded" })
  async detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param("slug", new JobSlugValidationPipe()) slug: string
  ): Promise<MatchBriefDetail> {
    return this.matchBriefs.evaluateJob(user.id, slug);
  }
}

