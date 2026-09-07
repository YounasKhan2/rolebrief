import { createParamDecorator, ExecutionContext, SetMetadata } from "@nestjs/common";
import { Role, UserStatus, OnboardingStatus } from "@prisma/client";
import { AUTH_USER_KEY } from "./auth.constants";

export const ROLES_KEY = "roles";
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
export const Public = () => SetMetadata("public", true);

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  normalizedEmail: string;
  role: Role;
  status: UserStatus;
  sessionId: string;
  onboardingStatus: OnboardingStatus;
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return req[AUTH_USER_KEY] as AuthenticatedUser | undefined;
});
