import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AuthenticatedUser, CurrentUser } from "../../auth/auth.decorators";
import { CsrfGuard } from "../../auth/csrf.guard";
import { SavedService } from "./saved.service";

@ApiTags("saved")
@ApiBearerAuth()
@Controller("saved")
export class SavedController {
  constructor(private readonly savedService: SavedService) {}

  @Get("jobs/slugs")
  @ApiOperation({ summary: "Get all saved job slugs for the authenticated user" })
  @ApiResponse({ status: 200, description: "List of saved job slugs" })
  async getSavedJobSlugs(@CurrentUser() user: AuthenticatedUser) {
    const slugs = await this.savedService.getSavedJobSlugs(user.id);
    return { slugs };
  }

  @Get("jobs")
  @ApiOperation({ summary: "Get all saved jobs for the authenticated user" })
  @ApiResponse({ status: 200, description: "List of saved jobs with serialized details" })
  getSavedJobs(@CurrentUser() user: AuthenticatedUser) {
    return this.savedService.getSavedJobs(user.id);
  }

  @Post("jobs/:slug")
  @HttpCode(HttpStatus.OK)
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: "Save a job by slug" })
  @ApiResponse({ status: 200, description: "Job saved successfully" })
  @ApiResponse({ status: 404, description: "Job slug not found" })
  saveJob(
    @CurrentUser() user: AuthenticatedUser,
    @Param("slug") slug: string
  ) {
    return this.savedService.saveJob(user.id, slug);
  }

  @Delete("jobs/:slug")
  @HttpCode(HttpStatus.OK)
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: "Unsave a job by slug" })
  @ApiResponse({ status: 200, description: "Job unsaved successfully (idempotent)" })
  unsaveJob(
    @CurrentUser() user: AuthenticatedUser,
    @Param("slug") slug: string
  ) {
    return this.savedService.unsaveJob(user.id, slug);
  }
}
