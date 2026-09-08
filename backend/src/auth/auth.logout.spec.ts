import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE } from "./auth.constants";
import { hashToken } from "./auth.utils";

function createMockConfig() {
  return {
    auth: {
      cookieSecure: true,
      cookieSameSite: "lax",
      accessTokenTtlSeconds: 900,
      refreshSessionTtlSeconds: 2592000,
      rateLimits: {
        login: { points: 5, duration: 900 },
        signup: { points: 3, duration: 3600 },
        refresh: { points: 30, duration: 300 }
      }
    }
  } as any;
}

function createMockResponse() {
  const clearedCookies: Array<{ name: string; options: any }> = [];
  const setCookies: Array<{ name: string; val: any; options: any }> = [];
  return {
    clearCookie(name: string, options: any) {
      clearedCookies.push({ name, options });
    },
    cookie(name: string, val: any, options: any) {
      setCookies.push({ name, val, options });
    },
    clearedCookies,
    setCookies
  };
}

test("logout with valid access token: revokes token family, audits, and symmetrically clears cookies", async () => {
  const rawAccessToken = "valid-access-token-123";
  const accessTokenHash = hashToken(rawAccessToken);
  const tokenFamilyId = "family-uuid-1";
  const userId = "user-uuid-1";

  let updatedFamilyId = "";
  let updatedReason = "";
  let auditEvent = "";

  const mockPrisma = {
    session: {
      async findUnique({ where }: any) {
        if (where.accessTokenHash === accessTokenHash) {
          return { id: "sess-1", tokenFamilyId, userId, revokedAt: null };
        }
        return null;
      },
      async updateMany({ where, data }: any) {
        updatedFamilyId = where.tokenFamilyId;
        updatedReason = data.revokedReason;
        return { count: 1 };
      }
    },
    authAuditEvent: {
      async create({ data }: any) {
        auditEvent = data.eventType;
        return { id: "audit-1" };
      }
    }
  } as any;

  const authService = new AuthService(
    mockPrisma,
    {} as any,
    {} as any,
    createMockConfig(),
    {} as any
  );

  const mockReq = {
    cookies: { [ACCESS_COOKIE]: rawAccessToken }
  } as any;
  const mockRes = createMockResponse();

  const result = await authService.logout(mockReq, mockRes as any);

  assert.equal(result.message, "Logged out.");
  assert.equal(updatedFamilyId, tokenFamilyId, "Must revoke by tokenFamilyId");
  assert.equal(updatedReason, "logout");
  assert.equal(auditEvent, "logout");

  // Verify symmetric cookie clearing
  assert.equal(mockRes.clearedCookies.length, 3);
  const clearedNames = mockRes.clearedCookies.map((c) => c.name);
  assert.deepEqual(clearedNames, [ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE]);

  const accessClear = mockRes.clearedCookies.find((c) => c.name === ACCESS_COOKIE);
  assert.equal(accessClear?.options.path, "/api/v1");
  assert.equal(accessClear?.options.httpOnly, true);
  assert.equal(accessClear?.options.secure, true);
  assert.equal(accessClear?.options.sameSite, "lax");

  const refreshClear = mockRes.clearedCookies.find((c) => c.name === REFRESH_COOKIE);
  assert.equal(refreshClear?.options.path, "/api/v1/auth");
  assert.equal(refreshClear?.options.httpOnly, true);

  const csrfClear = mockRes.clearedCookies.find((c) => c.name === CSRF_COOKIE);
  assert.equal(csrfClear?.options.path, "/api/v1");
  assert.equal(csrfClear?.options.httpOnly, false);
});

test("logout with expired/missing access token: falls back to refresh cookie (idle logout)", async () => {
  const rawRefreshToken = "valid-refresh-token-456";
  const refreshTokenHash = hashToken(rawRefreshToken);
  const tokenFamilyId = "family-uuid-idle";
  const userId = "user-uuid-idle";

  let updatedFamilyId = "";
  let updatedReason = "";

  const mockPrisma = {
    session: {
      async findUnique({ where }: any) {
        if (where.refreshTokenHash === refreshTokenHash) {
          return { id: "sess-idle", tokenFamilyId, userId, revokedAt: null };
        }
        return null;
      },
      async updateMany({ where, data }: any) {
        updatedFamilyId = where.tokenFamilyId;
        updatedReason = data.revokedReason;
        return { count: 1 };
      }
    },
    authAuditEvent: {
      async create() {
        return { id: "audit-2" };
      }
    }
  } as any;

  const authService = new AuthService(
    mockPrisma,
    {} as any,
    {} as any,
    createMockConfig(),
    {} as any
  );

  // Missing or expired access token, only refresh cookie is supplied
  const mockReq = {
    cookies: { [REFRESH_COOKIE]: rawRefreshToken }
  } as any;
  const mockRes = createMockResponse();

  const result = await authService.logout(mockReq, mockRes as any);

  assert.equal(result.message, "Logged out.");
  assert.equal(updatedFamilyId, tokenFamilyId, "Idle logout must revoke token family via refresh token");
  assert.equal(updatedReason, "logout");
  assert.equal(mockRes.clearedCookies.length, 3);
});

test("logout idempotency: unknown or already revoked token returns generic 200 and clears cookies", async () => {
  const mockPrisma = {
    session: {
      async findUnique() {
        return null; // Not found or already purged
      }
    }
  } as any;

  const authService = new AuthService(
    mockPrisma,
    {} as any,
    {} as any,
    createMockConfig(),
    {} as any
  );

  const mockReq = {
    cookies: { [ACCESS_COOKIE]: "stale-or-unknown-token" }
  } as any;
  const mockRes = createMockResponse();

  const result = await authService.logout(mockReq, mockRes as any);

  assert.equal(result.message, "Logged out.");
  assert.equal(mockRes.clearedCookies.length, 3, "Cookies must still be cleared even if session is not found");
});

test("race condition protection: logout revokes tokenFamilyId so concurrent/subsequent refresh cannot recreate active session", async () => {
  const rawRefreshToken = "refresh-token-race";
  const refreshTokenHash = hashToken(rawRefreshToken);
  const tokenFamilyId = "family-uuid-race";
  const userId = "user-race";

  let sessionState = {
    id: "sess-race-1",
    userId,
    tokenFamilyId,
    revokedAt: null as Date | null,
    revokedReason: null as string | null,
    expiresAt: new Date(Date.now() + 100000),
    user: { id: userId, status: "ACTIVE" }
  };

  const mockPrisma = {
    session: {
      async findUnique({ where }: any) {
        if (where.refreshTokenHash === refreshTokenHash || where.id === sessionState.id) {
          return sessionState;
        }
        return null;
      },
      async updateMany({ where, data }: any) {
        if (where.tokenFamilyId === tokenFamilyId) {
          sessionState.revokedAt = data.revokedAt;
          sessionState.revokedReason = data.revokedReason;
          return { count: 1 };
        }
        return { count: 0 };
      }
    },
    authAuditEvent: {
      async create() { return { id: "audit-3" }; }
    }
  } as any;

  const mockRateLimit = {
    async consume() { return; }
  };

  const authService = new AuthService(
    mockPrisma,
    {} as any,
    {} as any,
    createMockConfig(),
    mockRateLimit as any
  );

  // 1. Logout executes and revokes the family
  const mockReqLogout = {
    cookies: { [REFRESH_COOKIE]: rawRefreshToken }
  } as any;
  const mockResLogout = createMockResponse();

  await authService.logout(mockReqLogout, mockResLogout as any);
  assert.ok(sessionState.revokedAt !== null, "Session must be revoked by logout");

  // 2. Now a concurrent or trailing refresh arrives with the same refresh token
  const mockReqRefresh = {
    cookies: { [REFRESH_COOKIE]: rawRefreshToken },
    get: () => "test-agent"
  } as any;
  const mockResRefresh = createMockResponse();

  await assert.rejects(
    async () => {
      await authService.refresh(mockReqRefresh, mockResRefresh as any);
    },
    (err: unknown) => {
      assert.ok(err instanceof UnauthorizedException);
      return true;
    },
    "Refresh must fail when token family was revoked by logout"
  );
});

test("logoutAll: revokes all user sessions and symmetrically clears cookies", async () => {
  const userId = "usr-all-1";
  let revokedUserId = "";
  let auditCount = 0;

  const mockPrisma = {
    session: {
      async updateMany({ where, data }: any) {
        revokedUserId = where.userId;
        return { count: 4 };
      }
    },
    authAuditEvent: {
      async create() {
        auditCount++;
        return { id: "audit-all" };
      }
    }
  } as any;

  const authService = new AuthService(
    mockPrisma,
    {} as any,
    {} as any,
    createMockConfig(),
    {} as any
  );

  const mockUser = { id: userId, email: "user@test.com", role: "USER", status: "ACTIVE", sessionId: "s1" } as any;
  const mockRes = createMockResponse();

  const result = await authService.logoutAll(mockUser, mockRes as any);

  assert.equal(result.message, "All sessions logged out.");
  assert.equal(revokedUserId, userId);
  assert.equal(mockRes.clearedCookies.length, 3);
});
