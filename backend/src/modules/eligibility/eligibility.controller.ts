import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
  ValidationPipe
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AuthenticatedUser, CurrentUser } from "../../auth/auth.decorators";
import { UserRoleGuard } from "../../auth/user-role.guard";
import { JobSlugValidationPipe } from "../saved/saved.controller";
import { BatchEligibilityQueryDto } from "./dto/batch-eligibility-query.dto";
import {
  EligibilityBatchRateLimitGuard,
  EligibilityDetailRateLimitGuard
} from "./eligibility-rate-limit.guard";
import { EligibilityService } from "./eligibility.service";
import { DetailedEligibilityResult, EligibilitySummary } from "./reason-codes";

@ApiTags("eligibility")
@ApiBearerAuth()
@UseGuards(UserRoleGuard)
@Controller("eligibility")
export class EligibilityController {
  constructor(private readonly eligibilityService: EligibilityService) {}

  @Post("batch")
  @HttpCode(HttpStatus.OK)
  @UseGuards(EligibilityBatchRateLimitGuard)
  @ApiOperation({ summary: "Evaluate batch eligibility for up to 50 unique job slugs" })
  @ApiResponse({ status: 200, description: "Batch eligibility summaries" })
  @ApiResponse({ status: 400, description: "Validation error or limit exceeded" })
  @ApiResponse({ status: 403, description: "Forbidden for administrative accounts" })
  @ApiResponse({ status: 429, description: "Rate limit exceeded" })
  async evaluateBatch(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ValidationPipe({ transform: true, whitelist: true })) body: BatchEligibilityQueryDto
  ): Promise<EligibilitySummary[]> {
    return this.eligibilityService.evaluateBatch(user.id, body.slugs);
  }

  @Get("jobs/:slug")
  @UseGuards(EligibilityDetailRateLimitGuard)
  @ApiOperation({ summary: "Get detailed explainable eligibility evaluation for a specific job" })
  @ApiResponse({ status: 200, description: "Detailed eligibility evaluation with 4-dimension breakdown" })
  @ApiResponse({ status: 400, description: "Invalid job slug format" })
  @ApiResponse({ status: 403, description: "Forbidden for administrative accounts" })
  @ApiResponse({ status: 404, description: "Job not found" })
  @ApiResponse({ status: 429, description: "Rate limit exceeded" })
  async evaluateJob(
    @CurrentUser() user: AuthenticatedUser,
    @Param("slug", new JobSlugValidationPipe()) slug: string
  ): Promise<DetailedEligibilityResult> {
    return this.eligibilityService.evaluateJob(user.id, slug);
  }
}
