import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { OnboardingStatus, UserStatus } from "@prisma/client";
import { ACCESS_COOKIE, AUTH_USER_KEY } from "./auth.constants";
import { hashToken } from "./auth.utils";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService, private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>("public", [
      context.getHandler(),
      context.getClass()
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const token = req.cookies?.[ACCESS_COOKIE];
    if (!token) throw new UnauthorizedException("Authentication required.");

    const session = await this.prisma.session.findUnique({
      where: { accessTokenHash: hashToken(token) },
      include: { user: { include: { onboarding: true } } }
    });
    const now = new Date();
    if (!session || session.revokedAt || session.expiresAt <= now || session.accessExpiresAt <= now) {
      throw new UnauthorizedException("Authentication required.");
    }
    if (session.user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException("Account is not active.");
    }

    // Throttle activity updates: update at most once every 15 minutes per session
    const THROTTLE_MS = 15 * 60 * 1000;
    if (!session.lastUsedAt || (now.getTime() - session.lastUsedAt.getTime() > THROTTLE_MS)) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { lastUsedAt: now }
      });
    }

    const authUser = {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      normalizedEmail: session.user.normalizedEmail,
      role: session.user.role,
      status: session.user.status,
      sessionId: session.id,
      onboardingStatus: session.user.onboarding?.status ?? OnboardingStatus.NOT_STARTED
    };
    req[AUTH_USER_KEY] = authUser;
    (req as any).user = authUser;
    return true;
  }
}
