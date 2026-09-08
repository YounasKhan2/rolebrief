-- CreateEnum
CREATE TYPE "ApplicationStage" AS ENUM ('SAVED', 'APPLIED', 'INTERVIEWING', 'OFFER', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ApplicationLifecycle" AS ENUM ('ACTIVE', 'ARCHIVED');

-- AlterTable
ALTER TABLE "Application" DROP COLUMN IF EXISTS "stage";
ALTER TABLE "Application" ADD COLUMN "stage" "ApplicationStage" NOT NULL DEFAULT 'SAVED';
ALTER TABLE "Application" ADD COLUMN "jobSlug" TEXT;
ALTER TABLE "Application" ADD COLUMN "providerName" TEXT;
ALTER TABLE "Application" ADD COLUMN "applicationUrl" TEXT;
ALTER TABLE "Application" ADD COLUMN "locationLabel" TEXT;
ALTER TABLE "Application" ADD COLUMN "workMode" TEXT;
ALTER TABLE "Application" ADD COLUMN "employerDeadlineAt" TIMESTAMP(3);
ALTER TABLE "Application" ADD COLUMN "sourceUrl" TEXT;
ALTER TABLE "Application" ADD COLUMN "sourceLabel" TEXT;
ALTER TABLE "Application" ADD COLUMN "contactName" TEXT;
ALTER TABLE "Application" ADD COLUMN "contactEmail" TEXT;
ALTER TABLE "Application" ADD COLUMN "lifecycle" "ApplicationLifecycle" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Application" ADD COLUMN "nextActionAt" TIMESTAMP(3);
ALTER TABLE "Application" ADD COLUMN "reminderAt" TIMESTAMP(3);
ALTER TABLE "Application" ADD COLUMN "interviewAt" TIMESTAMP(3);
ALTER TABLE "Application" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;

-- DropForeignKey
ALTER TABLE "Application" DROP CONSTRAINT IF EXISTS "Application_jobId_fkey";

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "Application_userId_jobId_key" ON "Application"("userId", "jobId");
CREATE INDEX "Application_userId_lifecycle_stage_idx" ON "Application"("userId", "lifecycle", "stage");
CREATE INDEX "Application_userId_updatedAt_idx" ON "Application"("userId", "updatedAt");

-- CreateTable
CREATE TABLE "ApplicationHistory" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fromStage" "ApplicationStage",
    "toStage" "ApplicationStage" NOT NULL,
    "note" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApplicationHistory_applicationId_occurredAt_idx" ON "ApplicationHistory"("applicationId", "occurredAt");

-- AddForeignKey
ALTER TABLE "ApplicationHistory" ADD CONSTRAINT "ApplicationHistory_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
