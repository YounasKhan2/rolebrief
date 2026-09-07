import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AuthenticatedUser, CurrentUser } from "../../auth/auth.decorators";
import { CsrfGuard } from "../../auth/csrf.guard";
import { UpdateCandidateProfilePayloadDto } from "./dto/profile.dto";
import { ProfileService } from "./profile.service";

@ApiTags("profile")
@ApiBearerAuth()
@Controller("me/profile")
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @ApiOperation({ summary: "Get current candidate profile, preferences, skills, and completeness score" })
  @ApiResponse({ status: 200, description: "Returns the candidate's canonical profile data" })
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.profileService.getProfile(user.id);
  }

  @Patch()
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: "Update canonical candidate profile, preferences, or skills" })
  @ApiResponse({ status: 200, description: "Profile updated successfully" })
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateCandidateProfilePayloadDto
  ) {
    return this.profileService.updateProfile(user.id, body);
  }
}
