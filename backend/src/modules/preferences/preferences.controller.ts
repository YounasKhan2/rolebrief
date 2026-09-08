import {
  Body,
  Controller,
  Get,
  Patch,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AuthenticatedUser, CurrentUser } from "../../auth/auth.decorators";
import { CsrfGuard } from "../../auth/csrf.guard";
import { UpdatePreferencesDto } from "./dto/preferences.dto";
import { PreferencesRateLimitGuard } from "./preferences-rate-limit.guard";
import { PreferencesService } from "./preferences.service";

@ApiTags("preferences")
@ApiBearerAuth()
@Controller("me/preferences")
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  @Get()
  @ApiOperation({
    summary: "Get current user preferences, accessibility, and timezone settings (read-only)"
  })
  @ApiResponse({ status: 200, description: "Current user preferences or virtual defaults" })
  getPreferences(@CurrentUser() user: AuthenticatedUser) {
    return this.preferencesService.getPreferences(user.id);
  }

  @Patch()
  @UseGuards(CsrfGuard, PreferencesRateLimitGuard)
  @ApiOperation({ summary: "Update user preferences with atomic optimistic revision concurrency" })
  @ApiResponse({ status: 200, description: "Updated preferences" })
  @ApiResponse({ status: 409, description: "Concurrent update detected (stale revision)" })
  @ApiResponse({ status: 429, description: "Too Many Requests (rate limit exceeded)" })
  updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdatePreferencesDto
  ) {
    return this.preferencesService.updatePreferences(user.id, body);
  }
}
