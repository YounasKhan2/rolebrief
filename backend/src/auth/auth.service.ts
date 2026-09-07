import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { Prisma, Role, User, UserStatus } from "@prisma/client";
import { Response, Request } from "express";
import { randomUUID } from "crypto";
import { AppConfigService } from "../common/config/app-config.service";
import { PrismaService } from "../prisma/prisma.service";
import { ACCESS_COOKIE, CSRF_COOKIE, REFRESH_COOKIE } from "./auth.constants";
import { addSeconds, hashToken, normalizeEmail, randomToken, redactEmail, safeUserAgent } from "./auth.utils";
import { PasswordService } from "./password.service";
import { EmailService } from "./email/email.service";
import { AuthRateLimitService } from "./rate-limit.service";
import { AuthenticatedUser } from "./auth.decorators";

const GENERIC_LOGIN_ERROR = "Invalid email or password.";
const RECOVERY_RESPONSE = { message: "If the account can be recovered, instructions will be sent." };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly email: EmailService,
    private readonly config: AppConfigService,
    private readonly rateLimit: AuthRateLimitService
  ) {}

  me(user: AuthenticatedUser) {
    return this.publicUser(user);
  }

  async signup(name: string, email: string, password: string, req: Request) {
    await this.rateLimit.consume("signup", this.clientKey(req), this.config.auth.rateLimits.signup);
    const normalizedEmail = normalizeEmail(email);
    const passwordHash = await this.passwords.hash(password);
    try {
      const user = await this.prisma.user.create({
        data: { name: name.trim(), email, normalizedEmail, passwordHash, role: Role.USER, status: UserStatus.PENDING_VERIFICATION }
      });
      const verification = await this.createEmailVerificationToken(user.id);
      await this.enqueueSafely("verification", () => this.email.sendVerification(user.id, user.email, verification.id, verification.token));
      await this.audit("signup", true, { targetUserId: user.id, metadata: { email: redactEmail(user.email) } });
      return { message: "Check your email to verify your account." };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("An account with this email already exists.");
      }
      throw error;
    }
  }

  async login(email: string, password: string, req: Request, res: Response) {
    await this.rateLimit.consume("login", `${this.clientKey(req)}:${normalizeEmail(email)}`, this.config.auth.rateLimits.login);
    const user = await this.prisma.user.findUnique({ where: { normalizedEmail: normalizeEmail(email) } });
    if (!user) throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    if (user.status === UserStatus.DISABLED || user.status === UserStatus.LOCKED || (user.lockedUntil && user.lockedUntil > new Date())) {
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }
    if (user.status !== UserStatus.ACTIVE) throw new UnauthorizedException("Email verification required.");

    const valid = await this.passwords.verify(user.passwordHash, password);
    if (!valid) {
      await this.recordFailedLogin(user);
      await this.audit("login.failed", false, { targetUserId: user.id });
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() }
    });
    const session = await this.createSession(user.id, req);
    this.setAuthCookies(res, session.accessToken, session.refreshToken);
    await this.audit("login.success", true, { actorUserId: user.id, targetUserId: user.id });
    return { user: this.publicUser({ ...user, sessionId: session.id }) };
  }

  async refresh(req: Request, res: Response) {
    await this.rateLimit.consume("refresh", this.clientKey(req), this.config.auth.rateLimits.refresh, 300);
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw new UnauthorizedException("Authentication required.");
    const refreshTokenHash = hashToken(token);
    const now = new Date();
    const existing = await this.prisma.session.findUnique({ where: { refreshTokenHash }, include: { user: true } });
    if (!existing) throw new UnauthorizedException("Authentication required.");
    if (existing.revokedAt) {
      await this.prisma.session.updateMany({
        where: { tokenFamilyId: existing.tokenFamilyId, revokedAt: null },
        data: { revokedAt: now, revokedReason: "refresh_reuse_detected" }
      });
      throw new UnauthorizedException("Authentication required.");
    }
    if (existing.expiresAt <= now || existing.user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException("Authentication required.");
    }

    const accessToken = randomToken();
    const refreshToken = randomToken();
    const created = await this.prisma.$transaction(async (tx) => {
      const current = await tx.session.findUnique({ where: { id: existing.id } });
      if (!current || current.revokedAt) throw new UnauthorizedException("Authentication required.");
      const next = await tx.session.create({
        data: {
          userId: existing.userId,
          accessTokenHash: hashToken(accessToken),
          refreshTokenHash: hashToken(refreshToken),
          tokenFamilyId: existing.tokenFamilyId,
          expiresAt: existing.expiresAt,
          accessExpiresAt: addSeconds(now, this.config.auth.accessTokenTtlSeconds),
          ipAddress: this.clientIp(req),
          userAgent: safeUserAgent(req.get("user-agent"))
        }
      });
      await tx.session.update({
        where: { id: existing.id },
        data: { revokedAt: now, revokedReason: "rotated", replacedBySessionId: next.id, lastUsedAt: now }
      });
      return next;
    });

    this.setAuthCookies(res, accessToken, refreshToken);
    return { user: this.publicUser({ ...existing.user, sessionId: created.id }) };
  }

  async logout(user: AuthenticatedUser | undefined, res: Response) {
    if (user) {
      await this.prisma.session.updateMany({
        where: { id: user.sessionId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: "logout" }
      });
    }
    this.clearAuthCookies(res);
    return { message: "Logged out." };
  }

  setCsrfCookie(res: Response) {
    const csrf = randomToken(16);
    res.cookie(CSRF_COOKIE, csrf, {
      httpOnly: false,
      secure: this.config.auth.cookieSecure,
      sameSite: this.config.auth.cookieSameSite as "lax" | "strict" | "none",
      path: "/api/v1"
    });
    return { csrf };
  }

  async verifyEmail(token: string, req?: Request) {
    if (req) {
      await this.rateLimit.consume("verify", this.clientKey(req), this.config.auth.rateLimits.recovery);
    }
    const now = new Date();
    const tokenHash = hashToken(token);
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    if (!record) {
      throw new BadRequestException("Verification link is invalid or expired.");
    }

    if (record.consumedAt || record.user.status === UserStatus.ACTIVE) {
      return { message: "Email is already verified. You can log in." };
    }

    if (record.expiresAt <= now) {
      throw new BadRequestException("Verification link has expired. Please request a new one.");
    }

    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({ where: { id: record.id }, data: { consumedAt: now } }),
      this.prisma.user.update({ where: { id: record.userId }, data: { status: UserStatus.ACTIVE, emailVerifiedAt: now } })
    ]);
    await this.audit("email.verified", true, { targetUserId: record.userId });
    return { message: "Email verified. You can now log in." };
  }

  async resendVerification(email: string, req: Request) {
    await this.rateLimit.consume("resend", this.clientKey(req), this.config.auth.rateLimits.recovery);
    const user = await this.prisma.user.findUnique({ where: { normalizedEmail: normalizeEmail(email) } });
    if (user && user.status === UserStatus.PENDING_VERIFICATION) {
      const verification = await this.createEmailVerificationToken(user.id);
      await this.enqueueSafely("verification", () => this.email.sendVerification(user.id, user.email, verification.id, verification.token));
    }
    return RECOVERY_RESPONSE;
  }

  async forgotPassword(email: string, req: Request) {
    await this.rateLimit.consume("forgot", this.clientKey(req), this.config.auth.rateLimits.recovery);
    const user = await this.prisma.user.findUnique({ where: { normalizedEmail: normalizeEmail(email) } });
    if (user && user.status !== UserStatus.DISABLED) {
      const reset = await this.createPasswordResetToken(user.id);
      await this.enqueueSafely("password_reset", () => this.email.sendPasswordReset(user.id, user.email, reset.id, reset.token));
    }
    return RECOVERY_RESPONSE;
  }

  async resetPassword(token: string, password: string, req?: Request) {
    if (req) {
      await this.rateLimit.consume("reset", this.clientKey(req), this.config.auth.rateLimits.recovery);
    }
    const now = new Date();
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
    if (!record || record.consumedAt || record.expiresAt <= now) throw new BadRequestException("Reset link is invalid or expired.");
    const passwordHash = await this.passwords.hash(password);
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({ where: { id: record.id }, data: { consumedAt: now } }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash, passwordChangedAt: now, failedLoginAttempts: 0, lockedUntil: null, status: UserStatus.ACTIVE }
      }),
      this.prisma.session.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: now, revokedReason: "password_reset" } })
    ]);
    await this.enqueueSafely("password_changed", () => this.email.sendPasswordChanged(record.userId, record.user.email));
    return { message: "Password updated. Please log in again." };
  }

  async changePassword(user: AuthenticatedUser, currentPassword: string, newPassword: string) {
    const existing = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const valid = await this.passwords.verify(existing.passwordHash, currentPassword);
    if (!valid) throw new UnauthorizedException("Current password is incorrect.");
    const passwordHash = await this.passwords.hash(newPassword);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash, passwordChangedAt: now } }),
      this.prisma.session.updateMany({ where: { userId: user.id, id: { not: user.sessionId }, revokedAt: null }, data: { revokedAt: now, revokedReason: "password_changed" } })
    ]);
    await this.enqueueSafely("password_changed", () => this.email.sendPasswordChanged(existing.id, existing.email));
    return { message: "Password changed." };
  }

  async listSessions(user: AuthenticatedUser) {
    const sessions = await this.prisma.session.findMany({
      where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: "desc" },
      select: { id: true, createdAt: true, lastUsedAt: true, expiresAt: true, userAgent: true }
    });
    return { sessions };
  }

  async revokeSession(user: AuthenticatedUser, sessionId: string) {
    await this.prisma.session.updateMany({
      where: { userId: user.id, id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: "user_revoked" }
    });
    return { message: "Session revoked." };
  }

  async logoutAll(user: AuthenticatedUser, res: Response) {
    await this.prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: "logout_all" }
    });
    this.clearAuthCookies(res);
    return { message: "All sessions logged out." };
  }

  async bootstrapAdmin() {
    const { enabled, email, password } = this.config.auth.bootstrap;
    if (!enabled) return { created: false, reason: "disabled" };
    if (!email || !password) throw new BadRequestException("Bootstrap admin email and password are required.");
    const normalizedEmail = normalizeEmail(email);
    const existing = await this.prisma.user.findUnique({ where: { normalizedEmail } });
    if (existing?.role === Role.ADMIN) return { created: false, reason: "already_admin" };
    if (existing) throw new ConflictException("Bootstrap email already belongs to a non-admin account.");
    const passwordHash = await this.passwords.hash(password);
    await this.prisma.user.create({
      data: { name: "RoleBrief Admin", email, normalizedEmail, passwordHash, role: Role.ADMIN, status: UserStatus.ACTIVE, emailVerifiedAt: new Date() }
    });
    return { created: true };
  }

  async audit(eventType: string, success: boolean, input: { actorUserId?: string; targetUserId?: string; metadata?: Prisma.InputJsonValue } = {}) {
    await this.prisma.authAuditEvent.create({
      data: { eventType, success, actorUserId: input.actorUserId, targetUserId: input.targetUserId, metadata: input.metadata }
    });
  }

  async ensureCanRemoveFinalAdmin(targetUserId: string) {
    const activeAdmins = await this.prisma.user.count({ where: { role: Role.ADMIN, status: UserStatus.ACTIVE } });
    const target = await this.prisma.user.findUniqueOrThrow({ where: { id: targetUserId } });
    if (target.role === Role.ADMIN && target.status === UserStatus.ACTIVE && activeAdmins <= 1) {
      throw new ForbiddenException("Cannot remove or disable the final active administrator.");
    }
  }

  private async createSession(userId: string, req: Request) {
    const now = new Date();
    const accessToken = randomToken();
    const refreshToken = randomToken();
    const session = await this.prisma.session.create({
      data: {
        userId,
        accessTokenHash: hashToken(accessToken),
        refreshTokenHash: hashToken(refreshToken),
        tokenFamilyId: randomUUID(),
        expiresAt: addSeconds(now, this.config.auth.refreshSessionTtlSeconds),
        accessExpiresAt: addSeconds(now, this.config.auth.accessTokenTtlSeconds),
        ipAddress: this.clientIp(req),
        userAgent: safeUserAgent(req.get("user-agent"))
      }
    });
    return { ...session, accessToken, refreshToken };
  }

  private async createEmailVerificationToken(userId: string) {
    const now = new Date();
    const token = randomToken();
    const [record] = await this.prisma.$transaction([
      this.prisma.emailVerificationToken.create({
        data: { userId, tokenHash: hashToken(token), expiresAt: addSeconds(now, 86400) }
      }),
      this.prisma.emailVerificationToken.updateMany({
        where: { userId, consumedAt: null, createdAt: { lt: now } },
        data: { consumedAt: now }
      })
    ]);
    return { id: record.id, token };
  }

  private async createPasswordResetToken(userId: string) {
    const now = new Date();
    const token = randomToken();
    const [record] = await this.prisma.$transaction([
      this.prisma.passwordResetToken.create({
        data: { userId, tokenHash: hashToken(token), expiresAt: addSeconds(now, 1800) }
      }),
      this.prisma.passwordResetToken.updateMany({
        where: { userId, consumedAt: null, createdAt: { lt: now } },
        data: { consumedAt: now }
      })
    ]);
    return { id: record.id, token };
  }

  private async recordFailedLogin(user: User) {
    const attempts = user.failedLoginAttempts + 1;
    const lockedUntil = attempts >= 8 ? addSeconds(new Date(), 900) : null;
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: attempts, lockedUntil, status: lockedUntil ? UserStatus.LOCKED : user.status }
    });
  }

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
    const cookieBase = {
      httpOnly: true,
      secure: this.config.auth.cookieSecure,
      sameSite: this.config.auth.cookieSameSite as "lax" | "strict" | "none",
    };
    res.cookie(ACCESS_COOKIE, accessToken, { ...cookieBase, path: "/api/v1", maxAge: this.config.auth.accessTokenTtlSeconds * 1000 });
    res.cookie(REFRESH_COOKIE, refreshToken, { ...cookieBase, path: "/api/v1/auth", maxAge: this.config.auth.refreshSessionTtlSeconds * 1000 });
    res.cookie(CSRF_COOKIE, randomToken(16), {
      httpOnly: false,
      secure: this.config.auth.cookieSecure,
      sameSite: this.config.auth.cookieSameSite as "lax" | "strict" | "none",
      path: "/api/v1"
    });
  }

  clearAuthCookies(res: Response) {
    res.clearCookie(ACCESS_COOKIE, { path: "/api/v1" });
    res.clearCookie(REFRESH_COOKIE, { path: "/api/v1/auth" });
    res.clearCookie(CSRF_COOKIE, { path: "/api/v1" });
  }

  private publicUser(user: Pick<User, "id" | "name" | "email" | "role" | "status"> & { sessionId?: string }) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      initials: user.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || user.email.slice(0, 2).toUpperCase(),
      role: user.role,
      status: user.status,
      isAdmin: user.role === Role.ADMIN
    };
  }

  private clientIp(req: Request) {
    return req.ip?.slice(0, 64);
  }

  private clientKey(req: Request) {
    return this.clientIp(req) ?? "unknown";
  }

  private async enqueueSafely(kind: string, work: () => Promise<unknown>) {
    try {
      await work();
    } catch (error) {
      this.logger.warn({ event: "auth.email.enqueue_failed", kind, error: error instanceof Error ? error.name : "unknown" });
    }
  }
}
