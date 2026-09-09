import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  ValidationPipe
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AuthenticatedUser, CurrentUser } from "../../auth/auth.decorators";
import { CsrfGuard } from "../../auth/csrf.guard";
import { UserRoleGuard } from "../../auth/user-role.guard";
import { NotificationsQueryDto } from "./dto/notifications-query.dto";
import {
  NotificationsService,
  PaginatedNotifications,
  SerializedNotification
} from "./notifications.service";

@ApiTags("notifications")
@ApiBearerAuth()
@UseGuards(UserRoleGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "List candidate notifications (keyset cursor paginated)" })
  @ApiResponse({ status: 200, description: "Paginated notifications" })
  async listNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
    query: NotificationsQueryDto
  ): Promise<PaginatedNotifications> {
    return this.notificationsService.listNotifications(user.id, query);
  }

  @Get("unread-count")
  @ApiOperation({ summary: "Get current unread notification count" })
  @ApiResponse({ status: 200, description: "Unread count" })
  async getUnreadCount(
    @CurrentUser() user: AuthenticatedUser
  ): Promise<{ unreadCount: number }> {
    return this.notificationsService.getUnreadCount(user.id);
  }

  @Patch(":id/read")
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: "Mark a single notification as read" })
  @ApiResponse({ status: 200, description: "Notification marked as read" })
  @ApiResponse({ status: 404, description: "Notification not found" })
  async markAsRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string
  ): Promise<SerializedNotification> {
    return this.notificationsService.markAsRead(user.id, id);
  }

  @Post("mark-all-read")
  @HttpCode(HttpStatus.OK)
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: "Mark all unread notifications as read" })
  @ApiResponse({ status: 200, description: "Count of notifications updated" })
  async markAllAsRead(
    @CurrentUser() user: AuthenticatedUser
  ): Promise<{ count: number }> {
    return this.notificationsService.markAllAsRead(user.id);
  }
}
