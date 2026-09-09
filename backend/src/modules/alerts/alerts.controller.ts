import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
  ValidationPipe
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AlertStatus } from "@prisma/client";
import { AuthenticatedUser, CurrentUser, Public } from "../../auth/auth.decorators";
import { CsrfGuard } from "../../auth/csrf.guard";
import { UserRoleGuard } from "../../auth/user-role.guard";
import { AlertsMutationRateLimitGuard } from "./alerts-rate-limit.guard";
import { AlertsService } from "./alerts.service";
import { AlertStatusActionDto } from "./dto/alert-status-action.dto";
import { CreateAlertDto } from "./dto/create-alert.dto";
import { UpdateAlertDto } from "./dto/update-alert.dto";
import { SerializedAlert } from "./alerts.types";

@ApiTags("alerts")
@ApiBearerAuth()
@UseGuards(UserRoleGuard)
@Controller("alerts")
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  @ApiOperation({ summary: "List candidate alert rules" })
  @ApiResponse({ status: 200, description: "List of alerts" })
  async listAlerts(@CurrentUser() user: AuthenticatedUser): Promise<SerializedAlert[]> {
    return this.alertsService.listAlerts(user.id);
  }

  @Post()
  @UseGuards(CsrfGuard, AlertsMutationRateLimitGuard)
  @ApiOperation({ summary: "Create a new alert rule" })
  @ApiResponse({ status: 201, description: "Alert created" })
  @ApiResponse({ status: 400, description: "Validation error or max alerts limit exceeded" })
  @ApiResponse({ status: 403, description: "Forbidden for admins" })
  async createAlert(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    dto: CreateAlertDto
  ): Promise<SerializedAlert> {
    return this.alertsService.createAlert(user.id, dto);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get alert rule by id" })
  @ApiResponse({ status: 200, description: "Alert details" })
  @ApiResponse({ status: 404, description: "Alert not found" })
  async getAlert(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string
  ): Promise<SerializedAlert> {
    return this.alertsService.getAlert(user.id, id);
  }

  @Patch(":id")
  @UseGuards(CsrfGuard, AlertsMutationRateLimitGuard)
  @ApiOperation({ summary: "Update alert criteria or delivery settings with optimistic concurrency" })
  @ApiResponse({ status: 200, description: "Alert updated" })
  @ApiResponse({ status: 404, description: "Alert not found" })
  @ApiResponse({ status: 409, description: "Concurrent modification conflict" })
  async updateAlert(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    dto: UpdateAlertDto
  ): Promise<SerializedAlert> {
    return this.alertsService.updateAlert(user.id, id, dto);
  }

  @Patch(":id/pause")
  @UseGuards(CsrfGuard, AlertsMutationRateLimitGuard)
  @ApiOperation({ summary: "Pause an active alert" })
  @ApiResponse({ status: 200, description: "Alert paused" })
  @ApiResponse({ status: 409, description: "Concurrent modification conflict" })
  async pauseAlert(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    dto: AlertStatusActionDto
  ): Promise<SerializedAlert> {
    return this.alertsService.setStatus(user.id, id, AlertStatus.PAUSED, dto.expectedRevision);
  }

  @Patch(":id/resume")
  @UseGuards(CsrfGuard, AlertsMutationRateLimitGuard)
  @ApiOperation({ summary: "Resume a paused alert" })
  @ApiResponse({ status: 200, description: "Alert resumed" })
  @ApiResponse({ status: 409, description: "Concurrent modification conflict" })
  async resumeAlert(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    dto: AlertStatusActionDto
  ): Promise<SerializedAlert> {
    return this.alertsService.setStatus(user.id, id, AlertStatus.ACTIVE, dto.expectedRevision);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  @UseGuards(CsrfGuard, AlertsMutationRateLimitGuard)
  @ApiOperation({ summary: "Delete an alert rule" })
  @ApiResponse({ status: 200, description: "Alert deleted" })
  @ApiResponse({ status: 404, description: "Alert not found" })
  async deleteAlert(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string
  ): Promise<{ deleted: boolean }> {
    return this.alertsService.deleteAlert(user.id, id);
  }

  @Get("unsubscribe/:token")
  @Public()
  @ApiOperation({ summary: "One-click unsubscribe or pause alert via signed HMAC token" })
  @ApiResponse({ status: 200, description: "Unsubscribe action processed" })
  @ApiResponse({ status: 400, description: "Invalid or expired token" })
  async unsubscribe(@Param("token") token: string) {
    return this.alertsService.handleUnsubscribe(token);
  }
}
