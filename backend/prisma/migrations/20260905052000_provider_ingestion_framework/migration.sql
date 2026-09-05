ALTER TABLE "Job" ADD COLUMN "remoteCountryCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Job" ADD COLUMN "remoteRestrictionLabels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Job" ADD COLUMN "remoteTimezoneRestrictions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Job" ADD COLUMN "canonicalFingerprint" TEXT;
ALTER TABLE "Job" ADD COLUMN "sourcePublishedAt" TIMESTAMP(3);
ALTER TABLE "Job" ADD COLUMN "sourceUpdatedAt" TIMESTAMP(3);
ALTER TABLE "Job" ADD COLUMN "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Job" ADD COLUMN "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Job" ADD COLUMN "providerExpiresAt" TIMESTAMP(3);
ALTER TABLE "Job" ADD COLUMN "applicationDeadlineAt" TIMESTAMP(3);
ALTER TABLE "Job" ADD COLUMN "deadlineMetadata" JSONB;
ALTER TABLE "Job" ADD COLUMN "expiredAt" TIMESTAMP(3);

UPDATE "Job"
SET "providerExpiresAt" = "expiresAt",
    "sourcePublishedAt" = "publishedAt",
    "sourceUpdatedAt" = "publishedAt",
    "lastSeenAt" = "updatedAt",
    "expiredAt" = CASE WHEN "status" = 'EXPIRED' THEN "expiresAt" ELSE NULL END,
    "deadlineMetadata" = CASE
      WHEN "expiresAt" IS NOT NULL THEN jsonb_build_object('type', 'provider_expiry', 'source', 'provider', 'confidence', 'provider_reported')
      ELSE NULL
    END;

ALTER TABLE "IngestionRun" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'incremental';
ALTER TABLE "IngestionRun" ADD COLUMN "startingCheckpoint" TEXT;
ALTER TABLE "IngestionRun" ADD COLUMN "pagesRequested" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "IngestionRun" ADD COLUMN "pagesCompleted" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "IngestionRun" ADD COLUMN "recordsExpired" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "IngestionRun" ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "IngestionRun" ADD COLUMN "terminalCheckpoint" TEXT;

CREATE TABLE "IngestionCheckpoint" (
  "providerId" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "cursor" TEXT,
  "watermarkExternalId" TEXT,
  "watermarkContentHash" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "metadata" JSONB,

  CONSTRAINT "IngestionCheckpoint_pkey" PRIMARY KEY ("providerId", "mode")
);

CREATE INDEX "Job_canonicalFingerprint_idx" ON "Job"("canonicalFingerprint");
CREATE INDEX "IngestionCheckpoint_providerId_updatedAt_idx" ON "IngestionCheckpoint"("providerId", "updatedAt");
