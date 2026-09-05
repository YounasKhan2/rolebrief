CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "UserStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'LOCKED', 'DISABLED');

ALTER TABLE "User" ADD COLUMN "normalizedEmail" TEXT;
UPDATE "User" SET "email" = concat('legacy-', "id", '@invalid.local') WHERE "email" IS NULL;
UPDATE "User" SET "normalizedEmail" = lower("email");
ALTER TABLE "User" ALTER COLUMN "email" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "normalizedEmail" SET NOT NULL;

ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT NOT NULL DEFAULT '$argon2id$v=19$m=65536,t=3,p=4$disableddisabled12$disabledplaceholderhash000000000000000000000';
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "lockedUntil" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3);

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role" USING (
  CASE WHEN lower("role") = 'admin' THEN 'ADMIN' ELSE 'USER' END
)::"Role";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER';

ALTER TABLE "User" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "status" TYPE "UserStatus" USING (
  CASE
    WHEN lower("status") = 'active' THEN 'ACTIVE'
    WHEN lower("status") = 'locked' THEN 'LOCKED'
    WHEN lower("status") = 'disabled' THEN 'DISABLED'
    ELSE 'PENDING_VERIFICATION'
  END
)::"UserStatus";
ALTER TABLE "User" ALTER COLUMN "status" SET DEFAULT 'PENDING_VERIFICATION';

CREATE INDEX "User_role_status_idx" ON "User"("role", "status");
CREATE INDEX "User_normalizedEmail_idx" ON "User"("normalizedEmail");

CREATE TABLE "Session" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "accessTokenHash" TEXT NOT NULL,
  "refreshTokenHash" TEXT NOT NULL,
  "tokenFamilyId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "accessExpiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "revokedReason" TEXT,
  "replacedBySessionId" TEXT,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailVerificationToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PasswordResetToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthAuditEvent" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT,
  "eventType" TEXT NOT NULL,
  "targetUserId" TEXT,
  "success" BOOLEAN NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Session_accessTokenHash_key" ON "Session"("accessTokenHash");
CREATE UNIQUE INDEX "Session_refreshTokenHash_key" ON "Session"("refreshTokenHash");
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");
CREATE INDEX "Session_tokenFamilyId_idx" ON "Session"("tokenFamilyId");
CREATE INDEX "Session_revokedAt_idx" ON "Session"("revokedAt");
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");
CREATE INDEX "EmailVerificationToken_userId_expiresAt_idx" ON "EmailVerificationToken"("userId", "expiresAt");
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_userId_expiresAt_idx" ON "PasswordResetToken"("userId", "expiresAt");
CREATE INDEX "AuthAuditEvent_eventType_createdAt_idx" ON "AuthAuditEvent"("eventType", "createdAt");
CREATE INDEX "AuthAuditEvent_actorUserId_createdAt_idx" ON "AuthAuditEvent"("actorUserId", "createdAt");
CREATE INDEX "AuthAuditEvent_targetUserId_createdAt_idx" ON "AuthAuditEvent"("targetUserId", "createdAt");

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_replacedBySessionId_fkey" FOREIGN KEY ("replacedBySessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuthAuditEvent" ADD CONSTRAINT "AuthAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuthAuditEvent" ADD CONSTRAINT "AuthAuditEvent_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
