import { Body, Controller, Get, Patch, Post, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AuthenticatedUser, CurrentUser } from "../../auth/auth.decorators";
import { CsrfGuard } from "../../auth/csrf.guard";
import { AutosaveOnboardingDto } from "./dto/onboarding.dto";
import { OnboardingService } from "./onboarding.service";

@ApiTags("onboarding")
@ApiBearerAuth()
@Controller("me/onboarding")
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get()
  @ApiOperation({ summary: "Get current onboarding workflow progress and candidate data (read-only)" })
  @ApiResponse({ status: 200, description: "Returns the current onboarding workflow state and profile" })
  getState(@CurrentUser() user: AuthenticatedUser) {
    return this.onboardingService.getOnboardingState(user.id);
  }

  @Put()
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: "Autosave onboarding step and candidate profile with optimistic revision check" })
  @ApiResponse({ status: 200, description: "Step saved and revision incremented" })
  @ApiResponse({ status: 409, description: "Optimistic concurrency conflict" })
  autosavePut(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AutosaveOnboardingDto
  ) {
    return this.onboardingService.autosave(user.id, body);
  }

  @Patch()
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: "Autosave onboarding step and candidate profile with optimistic revision check (PATCH alias)" })
  @ApiResponse({ status: 200, description: "Step saved and revision incremented" })
  @ApiResponse({ status: 409, description: "Optimistic concurrency conflict" })
  autosavePatch(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AutosaveOnboardingDto
  ) {
    return this.onboardingService.autosave(user.id, body);
  }

  @Post("skip")
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: "Skip onboarding and immediately unlock application" })
  @ApiResponse({ status: 200, description: "Onboarding marked as SKIPPED" })
  skip(@CurrentUser() user: AuthenticatedUser) {
    return this.onboardingService.skip(user.id);
  }

  @Post("complete")
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: "Finalize candidate onboarding" })
  @ApiResponse({ status: 200, description: "Onboarding marked as COMPLETED" })
  complete(@CurrentUser() user: AuthenticatedUser) {
    return this.onboardingService.complete(user.id);
  }
}
