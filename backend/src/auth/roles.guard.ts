import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Role } from "@prisma/client";
import { AUTH_USER_KEY } from "./auth.constants";
import { AuthenticatedUser, ROLES_KEY } from "./auth.decorators";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (!roles?.length) return true;

    const req = context.switchToHttp().getRequest();
    const user = req[AUTH_USER_KEY] as AuthenticatedUser | undefined;
    if (!user || !roles.includes(user.role)) {
      throw new ForbiddenException("Insufficient permissions.");
    }
    return true;
  }
}
