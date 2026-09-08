import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Injectable,
  Param,
  PipeTransform,
  Post,
  Query,
  UseGuards,
  ValidationPipe
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AuthenticatedUser, CurrentUser } from "../../auth/auth.decorators";
import { CsrfGuard } from "../../auth/csrf.guard";
import { SavedJobsQueryDto } from "./dto/saved-query.dto";
import { SavedService } from "./saved.service";

@Injectable()
export class JobSlugValidationPipe implements PipeTransform<string, string> {
  private static readonly SLUG_REGEX = /^[a-zA-Z0-9_-]{1,120}$/;

  transform(value: string): string {
    if (!value || typeof value !== "string" || !JobSlugValidationPipe.SLUG_REGEX.test(value)) {
      throw new BadRequestException("Invalid job slug format");
    }
    return value;
  }
}

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
  @ApiOperation({ summary: "Get all saved jobs for the authenticated user with cursor pagination" })
  @ApiResponse({ status: 200, description: "Paginated list of saved jobs with serialized details" })
  getSavedJobs(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ValidationPipe({ transform: true, whitelist: true })) query: SavedJobsQueryDto
  ) {
    return this.savedService.getSavedJobs(user.id, query);
  }

  @Post("jobs/:slug")
  @HttpCode(HttpStatus.OK)
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: "Save a job by slug" })
  @ApiResponse({ status: 200, description: "Job saved successfully" })
  @ApiResponse({ status: 400, description: "Invalid job slug format" })
  @ApiResponse({ status: 404, description: "Job slug not found" })
  saveJob(
    @CurrentUser() user: AuthenticatedUser,
    @Param("slug", new JobSlugValidationPipe()) slug: string
  ) {
    return this.savedService.saveJob(user.id, slug);
  }

  @Delete("jobs/:slug")
  @HttpCode(HttpStatus.OK)
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: "Unsave a job by slug" })
  @ApiResponse({ status: 200, description: "Job unsaved successfully (idempotent)" })
  @ApiResponse({ status: 400, description: "Invalid job slug format" })
  unsaveJob(
    @CurrentUser() user: AuthenticatedUser,
    @Param("slug", new JobSlugValidationPipe()) slug: string
  ) {
    return this.savedService.unsaveJob(user.id, slug);
  }
}
