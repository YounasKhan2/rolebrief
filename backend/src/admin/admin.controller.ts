import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Role, UserStatus } from "@prisma/client";
import { Roles, CurrentUser, AuthenticatedUser } from "../auth/auth.decorators";
import { CsrfGuard } from "../auth/csrf.guard";
import { UpdateUserRoleDto, UpdateUserStatusDto } from "../auth/dto/auth.dto";
import { AuthService } from "../auth/auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { AdminOperationsService } from "./admin-operations.service";
import { AdminModerationActionDto, AdminModerationQueueQueryDto } from "./dto/admin-operations.dto";

@ApiTags("admin")
@Controller("admin")
@Roles(Role.ADMIN)
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly operations: AdminOperationsService
  ) {}

  @Get("metrics")
  async metrics() {
    return this.operations.getMetrics();
  }

  @Get("sources")
  async sources() {
    return this.operations.getSources();
  }

  @Post("sources/:providerId/sync")
  @UseGuards(CsrfGuard)
  async syncSource(@CurrentUser() actor: AuthenticatedUser, @Param("providerId") providerId: string) {
    return this.operations.triggerSync(providerId, actor.id);
  }

  @Get("moderation/queue")
  async moderationQueue(@Query() query: AdminModerationQueueQueryDto) {
    return this.operations.getModerationQueue(query);
  }

  @Post("moderation/:jobId/action")
  @UseGuards(CsrfGuard)
  async moderationAction(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("jobId") jobId: string,
    @Body() body: AdminModerationActionDto
  ) {
    return this.operations.executeModerationAction(actor.id, jobId, body);
  }

  @Get("users")
  async users() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true
      }
    });
    return { users };
  }

  @Get("users/:id")
  async user(@Param("id") id: string) {
    return {
      user: await this.prisma.user.findUniqueOrThrow({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          emailVerifiedAt: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
          sessions: { where: { revokedAt: null }, select: { id: true, createdAt: true, lastUsedAt: true, expiresAt: true } }
        }
      })
    };
  }

  @Patch("users/:id/status")
  @UseGuards(CsrfGuard)
  async status(@CurrentUser() actor: AuthenticatedUser, @Param("id") id: string, @Body() body: UpdateUserStatusDto) {
    if (!Object.values(UserStatus).includes(body.status as UserStatus)) throw new BadRequestException("Invalid status.");
    if (body.status !== UserStatus.ACTIVE) await this.auth.ensureCanRemoveFinalAdmin(id);
    const user = await this.prisma.user.update({ where: { id }, data: { status: body.status as UserStatus } });
    if (body.status !== UserStatus.ACTIVE) {
      await this.prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: "admin_status_change" } });
    }
    await this.auth.audit("admin.user.status", true, { actorUserId: actor.id, targetUserId: id, metadata: { status: body.status } });
    return { user: this.adminUser(user) };
  }

  @Patch("users/:id/role")
  @UseGuards(CsrfGuard)
  async role(@CurrentUser() actor: AuthenticatedUser, @Param("id") id: string, @Body() body: UpdateUserRoleDto) {
    if (!Object.values(Role).includes(body.role as Role)) throw new BadRequestException("Invalid role.");
    if (body.role !== Role.ADMIN) await this.auth.ensureCanRemoveFinalAdmin(id);
    const user = await this.prisma.user.update({ where: { id }, data: { role: body.role as Role } });
    await this.prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: "admin_role_change" } });
    await this.auth.audit("admin.user.role", true, { actorUserId: actor.id, targetUserId: id, metadata: { role: body.role } });
    return { user: this.adminUser(user) };
  }

  private adminUser(user: { id: string; name: string; email: string; role: Role; status: UserStatus; emailVerifiedAt: Date | null; createdAt: Date; updatedAt: Date; lastLoginAt: Date | null }) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt
    };
  }
}

