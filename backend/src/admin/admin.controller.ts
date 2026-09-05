import { BadRequestException, Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Role, UserStatus } from "@prisma/client";
import { Roles, CurrentUser, AuthenticatedUser } from "../auth/auth.decorators";
import { CsrfGuard } from "../auth/csrf.guard";
import { UpdateUserRoleDto, UpdateUserStatusDto } from "../auth/dto/auth.dto";
import { AuthService } from "../auth/auth.service";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("admin")
@Controller("admin")
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly prisma: PrismaService, private readonly auth: AuthService) {}

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
