import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AuthenticatedUser, CurrentUser } from "../../auth/auth.decorators";
import { CsrfGuard } from "../../auth/csrf.guard";
import { UserRoleGuard } from "../../auth/user-role.guard";
import { ProfileRateLimitGuard } from "./profile-rate-limit.guard";
import { UpdateCandidateProfilePayloadDto } from "./dto/profile.dto";
import { ProfileService } from "./profile.service";

@ApiTags("profile")
@ApiBearerAuth()
@UseGuards(UserRoleGuard)
@Controller("me/profile")
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @ApiOperation({ summary: "Get current candidate profile, preferences, skills, and completeness score" })
  @ApiResponse({ status: 200, description: "Returns the candidate's canonical profile data" })
  @ApiResponse({ status: 403, description: "Forbidden for administrative accounts" })
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.profileService.getProfile(user.id);
  }

  @Patch()
  @UseGuards(CsrfGuard, ProfileRateLimitGuard)
  @ApiOperation({ summary: "Update canonical candidate profile, preferences, or skills with optimistic concurrency" })
  @ApiResponse({ status: 200, description: "Profile updated successfully" })
  @ApiResponse({ status: 403, description: "Forbidden for administrative accounts" })
  @ApiResponse({ status: 409, description: "Optimistic concurrency conflict" })
  @ApiResponse({ status: 429, description: "Too many profile mutation requests" })
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateCandidateProfilePayloadDto
  ) {
    return this.profileService.updateProfile(user.id, body);
  }
}
