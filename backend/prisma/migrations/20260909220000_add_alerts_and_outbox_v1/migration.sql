-- CreateEnum
CREATE TYPE "AlertCadence" AS ENUM ('IMMEDIATE', 'DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "AlertChannel" AS ENUM ('IN_APP', 'EMAIL', 'BOTH');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DISABLED');

-- CreateEnum
CREATE TYPE "AlertEligibilityPolicy" AS ENUM ('INCLUDE_ALL', 'NO_KNOWN_CONFLICTS');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "AlertMatchNotificationState" AS ENUM ('PENDING', 'CREATED', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "AlertMatchEmailState" AS ENUM ('PENDING', 'QUEUED', 'SENT', 'SUPPRESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('JOB_ALERT', 'APPLICATION_REMINDER', 'SYSTEM');

-- DropForeignKey
ALTER TABLE "AlertDelivery" DROP CONSTRAINT "AlertDelivery_alertId_fkey";

-- AlterTable
ALTER TABLE "Alert" DROP COLUMN "channels",
DROP COLUMN "filters",
ADD COLUMN     "channel" "AlertChannel" NOT NULL DEFAULT 'BOTH',
ADD COLUMN     "countryCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "criteriaJson" JSONB NOT NULL,
ADD COLUMN     "criteriaVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "deliveryDayOfWeek" INTEGER,
ADD COLUMN     "deliveryHourUtc" INTEGER NOT NULL DEFAULT 9,
ADD COLUMN     "eligibilityPolicy" "AlertEligibilityPolicy" NOT NULL DEFAULT 'NO_KNOWN_CONFLICTS',
ADD COLUMN     "employmentTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "lastDeliveredAt" TIMESTAMP(3),
ADD COLUMN     "lastEvaluatedAt" TIMESTAMP(3),
ADD COLUMN     "nextDeliveryDueAt" TIMESTAMP(3),
ADD COLUMN     "providers" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "salaryDisclosed" BOOLEAN,
ADD COLUMN     "workModes" "WorkMode"[] DEFAULT ARRAY[]::"WorkMode"[],
DROP COLUMN "cadence",
ADD COLUMN     "cadence" "AlertCadence" NOT NULL DEFAULT 'DAILY',
DROP COLUMN "status",
ADD COLUMN     "status" "AlertStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP DEFAULT;

-- DropTable
DROP TABLE "AlertDelivery";

-- CreateTable
CREATE TABLE "JobOutboxEvent" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL DEFAULT 'JOB_CREATED',
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobOutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertMatch" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "criteriaVersion" INTEGER NOT NULL,
    "matchScore" INTEGER,
    "eligibilityStatus" TEXT,
    "reasonsSummary" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notificationState" "AlertMatchNotificationState" NOT NULL DEFAULT 'PENDING',
    "notificationId" TEXT,
    "emailState" "AlertMatchEmailState" NOT NULL DEFAULT 'PENDING',
    "emailDeliveryId" TEXT,
    "suppressionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'JOB_ALERT',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "linkUrl" TEXT NOT NULL,
    "metadata" JSONB,
    "readAt" TIMESTAMP(3),
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobOutboxEvent_status_createdAt_idx" ON "JobOutboxEvent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "JobOutboxEvent_jobId_idx" ON "JobOutboxEvent"("jobId");

-- CreateIndex
CREATE INDEX "AlertMatch_userId_createdAt_idx" ON "AlertMatch"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AlertMatch_alertId_createdAt_idx" ON "AlertMatch"("alertId", "createdAt");

-- CreateIndex
CREATE INDEX "AlertMatch_emailState_createdAt_idx" ON "AlertMatch"("emailState", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AlertMatch_alertId_jobId_key" ON "AlertMatch"("alertId", "jobId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Alert_userId_status_idx" ON "Alert"("userId", "status");

-- CreateIndex
CREATE INDEX "Alert_status_cadence_nextDeliveryDueAt_idx" ON "Alert"("status", "cadence", "nextDeliveryDueAt");

-- CreateIndex
CREATE INDEX "Alert_status_salaryDisclosed_idx" ON "Alert"("status", "salaryDisclosed");

-- AddForeignKey
ALTER TABLE "JobOutboxEvent" ADD CONSTRAINT "JobOutboxEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertMatch" ADD CONSTRAINT "AlertMatch_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertMatch" ADD CONSTRAINT "AlertMatch_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

