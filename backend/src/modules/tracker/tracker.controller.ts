import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
  ValidationPipe
} from "@nestjs/common";
import type { Response } from "express";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AuthenticatedUser, CurrentUser } from "../../auth/auth.decorators";
import { CsrfGuard } from "../../auth/csrf.guard";
import {
  CreateApplicationDto,
  TrackerQueryDto,
  UpdateApplicationDto
} from "./dto/tracker.dto";
import { TrackerService } from "./tracker.service";

@ApiTags("tracker")
@ApiBearerAuth()
@Controller("tracker")
export class TrackerController {
  constructor(private readonly trackerService: TrackerService) {}

  @Get()
  @ApiOperation({ summary: "List tracked applications with cursor pagination and stage counts" })
  @ApiResponse({ status: 200, description: "Paginated list with stage counts" })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ValidationPipe({ transform: true, whitelist: true })) query: TrackerQueryDto
  ) {
    return this.trackerService.list(user.id, query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get application details and chronological history" })
  @ApiResponse({ status: 200, description: "Application details" })
  @ApiResponse({ status: 404, description: "Application not found" })
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string
  ) {
    return this.trackerService.getById(user.id, id);
  }

  @Post()
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: "Track a job or create a manual application" })
  @ApiResponse({ status: 201, description: "Application created" })
  @ApiResponse({ status: 200, description: "Application already tracked or restored" })
  @ApiResponse({ status: 400, description: "Invalid payload or validation failure" })
  @ApiResponse({ status: 404, description: "Referenced job not found" })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ValidationPipe({ transform: true, whitelist: true })) dto: CreateApplicationDto,
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.trackerService.create(user.id, dto);
    if (result.alreadyTracked || result.restored) {
      res.status(HttpStatus.OK);
    } else {
      res.status(HttpStatus.CREATED);
    }
    return result;
  }

  @Patch(":id/archive")
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: "Archive an application with optimistic concurrency check" })
  @ApiResponse({ status: 200, description: "Application archived" })
  @ApiResponse({ status: 404, description: "Application not found" })
  @ApiResponse({ status: 409, description: "Conflict: Stale revision" })
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Query("expectedRevision", ParseIntPipe) expectedRevision: number
  ) {
    return this.trackerService.archive(user.id, id, expectedRevision);
  }

  @Patch(":id/restore")
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: "Restore an archived application with optimistic concurrency check" })
  @ApiResponse({ status: 200, description: "Application restored" })
  @ApiResponse({ status: 404, description: "Application not found" })
  @ApiResponse({ status: 409, description: "Conflict: Stale revision" })
  restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Query("expectedRevision", ParseIntPipe) expectedRevision: number
  ) {
    return this.trackerService.restore(user.id, id, expectedRevision);
  }

  @Patch(":id")
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: "Update application stage, notes, or metadata with optimistic concurrency" })
  @ApiResponse({ status: 200, description: "Application updated successfully" })
  @ApiResponse({ status: 400, description: "Invalid transition or validation error" })
  @ApiResponse({ status: 404, description: "Application not found" })
  @ApiResponse({ status: 409, description: "Conflict: Stale revision" })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true })) dto: UpdateApplicationDto
  ) {
    return this.trackerService.update(user.id, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: "Delete application with optimistic concurrency check" })
  @ApiResponse({ status: 200, description: "Application deleted" })
  @ApiResponse({ status: 404, description: "Application not found" })
  @ApiResponse({ status: 409, description: "Conflict: Stale revision" })
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Query("expectedRevision", ParseIntPipe) expectedRevision: number
  ) {
    return this.trackerService.delete(user.id, id, expectedRevision);
  }
}
