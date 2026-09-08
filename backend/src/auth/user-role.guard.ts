import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Role } from "@prisma/client";
import { AUTH_USER_KEY } from "./auth.constants";
import { AuthenticatedUser } from "./auth.decorators";

@Injectable()
export class UserRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = (req[AUTH_USER_KEY] || req.user) as AuthenticatedUser | undefined;
    if (!user) return true;
    if (user.role === Role.ADMIN) {
      throw new ForbiddenException("Admins cannot manage candidate profiles. Please use the administrative workspace.");
    }
    return true;
  }
}
