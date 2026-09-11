CREATE TYPE "ResumeDocumentStatus" AS ENUM (
  'CREATED',
  'UPLOADING',
  'UPLOADED',
  'VERIFYING',
  'SCANNING',
  'VERIFIED_CLEAN',
  'EXTRACTING',
  'MAPPING',
  'READY_FOR_REVIEW',
  'APPLYING',
  'APPLIED',
  'REJECTED',
  'FAILED',
  'DELETED'
);

CREATE TYPE "ResumeDraftStatus" AS ENUM (
  'DRAFTING',
  'READY_FOR_REVIEW',
  'APPLIED',
  'SUPERSEDED',
  'DELETED'
);

CREATE TYPE "ResumeParseAttemptStatus" AS ENUM (
  'QUEUED',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'CANCELED'
);

CREATE TYPE "ResumeFailureCode" AS ENUM (
  'VALIDATION_FAILED',
  'STORAGE_UNAVAILABLE',
  'CHECKSUM_MISMATCH',
  'MIME_MISMATCH',
  'TYPE_UNSUPPORTED',
  'CAPACITY_EXHAUSTED',
  'SCAN_UNAVAILABLE',
  'INFECTED',
  'PARSER_TIMEOUT',
  'PARSER_FAILED',
  'MAPPER_FAILED'
);

CREATE TYPE "CandidateFactSource" AS ENUM (
  'USER_DECLARED',
  'RESUME_PARSED',
  'IMPORTED'
);

CREATE TABLE "ResumeDocument" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "ResumeDocumentStatus" NOT NULL DEFAULT 'CREATED',
  "originalFilenameSafe" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "extension" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "objectKey" TEXT NOT NULL,
  "storageBucket" TEXT NOT NULL,
  "uploadIdempotencyKey" TEXT NOT NULL,
  "uploadExpiresAt" TIMESTAMP(3) NOT NULL,
  "confirmedAt" TIMESTAMP(3),
  "verifiedAt" TIMESTAMP(3),
  "scannedAt" TIMESTAMP(3),
  "currentDraftId" TEXT,
  "parserVersion" TEXT,
  "mapperVersion" TEXT,
  "failureCode" "ResumeFailureCode",
  "failureMessageSafe" TEXT,
  "retentionDeleteAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResumeDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResumeParseAttempt" (
  "id" TEXT NOT NULL,
  "resumeDocumentId" TEXT NOT NULL,
  "status" "ResumeParseAttemptStatus" NOT NULL DEFAULT 'QUEUED',
  "queueJobId" TEXT,
  "attempt" INTEGER NOT NULL DEFAULT 1,
  "doclingArtifactObjectKey" TEXT,
  "metricsJson" JSONB,
  "failureCode" "ResumeFailureCode",
  "failureMessageSafe" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResumeParseAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResumeExtractionDraft" (
  "id" TEXT NOT NULL,
  "resumeDocumentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "ResumeDraftStatus" NOT NULL DEFAULT 'DRAFTING',
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "parserVersion" TEXT NOT NULL,
  "mapperVersion" TEXT NOT NULL,
  "sourceChecksum" TEXT NOT NULL,
  "itemsJson" JSONB NOT NULL,
  "summaryJson" JSONB,
  "reviewRevision" INTEGER NOT NULL DEFAULT 0,
  "targetProfileRevision" INTEGER,
  "reviewedAt" TIMESTAMP(3),
  "appliedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResumeExtractionDraft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CandidateExperience" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "company" TEXT NOT NULL,
  "location" TEXT,
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "isCurrent" BOOLEAN NOT NULL DEFAULT false,
  "description" TEXT,
  "source" "CandidateFactSource" NOT NULL DEFAULT 'USER_DECLARED',
  "sourceDocumentId" TEXT,
  "sourceDraftItemId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CandidateExperience_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CandidateEducation" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "institution" TEXT NOT NULL,
  "credential" TEXT,
  "fieldOfStudy" TEXT,
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "description" TEXT,
  "source" "CandidateFactSource" NOT NULL DEFAULT 'USER_DECLARED',
  "sourceDocumentId" TEXT,
  "sourceDraftItemId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CandidateEducation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CandidateProject" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT,
  "url" TEXT,
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "description" TEXT,
  "source" "CandidateFactSource" NOT NULL DEFAULT 'USER_DECLARED',
  "sourceDocumentId" TEXT,
  "sourceDraftItemId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CandidateProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CandidateCertification" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "issuer" TEXT,
  "issuedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "credentialId" TEXT,
  "url" TEXT,
  "source" "CandidateFactSource" NOT NULL DEFAULT 'USER_DECLARED',
  "sourceDocumentId" TEXT,
  "sourceDraftItemId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CandidateCertification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CandidateLanguage" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "language" TEXT NOT NULL,
  "proficiency" TEXT,
  "source" "CandidateFactSource" NOT NULL DEFAULT 'USER_DECLARED',
  "sourceDocumentId" TEXT,
  "sourceDraftItemId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CandidateLanguage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CandidateAward" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "issuer" TEXT,
  "awardedAt" TIMESTAMP(3),
  "description" TEXT,
  "source" "CandidateFactSource" NOT NULL DEFAULT 'USER_DECLARED',
  "sourceDocumentId" TEXT,
  "sourceDraftItemId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CandidateAward_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CandidatePublication" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "publisher" TEXT,
  "publishedAt" TIMESTAMP(3),
  "url" TEXT,
  "description" TEXT,
  "source" "CandidateFactSource" NOT NULL DEFAULT 'USER_DECLARED',
  "sourceDocumentId" TEXT,
  "sourceDraftItemId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CandidatePublication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CandidateLink" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "linkType" TEXT,
  "source" "CandidateFactSource" NOT NULL DEFAULT 'USER_DECLARED',
  "sourceDocumentId" TEXT,
  "sourceDraftItemId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CandidateLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResumeDocument_objectKey_key" ON "ResumeDocument"("objectKey");
CREATE UNIQUE INDEX "ResumeDocument_userId_uploadIdempotencyKey_key" ON "ResumeDocument"("userId", "uploadIdempotencyKey");
CREATE INDEX "ResumeDocument_userId_status_idx" ON "ResumeDocument"("userId", "status");
CREATE INDEX "ResumeDocument_userId_sha256_idx" ON "ResumeDocument"("userId", "sha256");
CREATE INDEX "ResumeDocument_status_createdAt_idx" ON "ResumeDocument"("status", "createdAt");
CREATE INDEX "ResumeDocument_retentionDeleteAt_idx" ON "ResumeDocument"("retentionDeleteAt");

CREATE UNIQUE INDEX "ResumeParseAttempt_queueJobId_key" ON "ResumeParseAttempt"("queueJobId");
CREATE INDEX "ResumeParseAttempt_resumeDocumentId_createdAt_idx" ON "ResumeParseAttempt"("resumeDocumentId", "createdAt");
CREATE INDEX "ResumeParseAttempt_status_createdAt_idx" ON "ResumeParseAttempt"("status", "createdAt");

CREATE UNIQUE INDEX "ResumeExtractionDraft_resumeDocumentId_sourceChecksum_mapperVersion_key" ON "ResumeExtractionDraft"("resumeDocumentId", "sourceChecksum", "mapperVersion");
CREATE INDEX "ResumeExtractionDraft_userId_status_idx" ON "ResumeExtractionDraft"("userId", "status");
CREATE INDEX "ResumeExtractionDraft_resumeDocumentId_createdAt_idx" ON "ResumeExtractionDraft"("resumeDocumentId", "createdAt");

CREATE INDEX "CandidateExperience_profileId_startDate_idx" ON "CandidateExperience"("profileId", "startDate");
CREATE INDEX "CandidateExperience_sourceDocumentId_idx" ON "CandidateExperience"("sourceDocumentId");
CREATE INDEX "CandidateEducation_profileId_endDate_idx" ON "CandidateEducation"("profileId", "endDate");
CREATE INDEX "CandidateEducation_sourceDocumentId_idx" ON "CandidateEducation"("sourceDocumentId");
CREATE INDEX "CandidateProject_profileId_updatedAt_idx" ON "CandidateProject"("profileId", "updatedAt");
CREATE INDEX "CandidateProject_sourceDocumentId_idx" ON "CandidateProject"("sourceDocumentId");
CREATE INDEX "CandidateCertification_profileId_issuedAt_idx" ON "CandidateCertification"("profileId", "issuedAt");
CREATE INDEX "CandidateCertification_sourceDocumentId_idx" ON "CandidateCertification"("sourceDocumentId");
CREATE UNIQUE INDEX "CandidateLanguage_profileId_language_key" ON "CandidateLanguage"("profileId", "language");
CREATE INDEX "CandidateLanguage_sourceDocumentId_idx" ON "CandidateLanguage"("sourceDocumentId");
CREATE INDEX "CandidateAward_profileId_awardedAt_idx" ON "CandidateAward"("profileId", "awardedAt");
CREATE INDEX "CandidateAward_sourceDocumentId_idx" ON "CandidateAward"("sourceDocumentId");
CREATE INDEX "CandidatePublication_profileId_publishedAt_idx" ON "CandidatePublication"("profileId", "publishedAt");
CREATE INDEX "CandidatePublication_sourceDocumentId_idx" ON "CandidatePublication"("sourceDocumentId");
CREATE INDEX "CandidateLink_profileId_linkType_idx" ON "CandidateLink"("profileId", "linkType");
CREATE INDEX "CandidateLink_sourceDocumentId_idx" ON "CandidateLink"("sourceDocumentId");

ALTER TABLE "ResumeDocument" ADD CONSTRAINT "ResumeDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResumeParseAttempt" ADD CONSTRAINT "ResumeParseAttempt_resumeDocumentId_fkey" FOREIGN KEY ("resumeDocumentId") REFERENCES "ResumeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResumeExtractionDraft" ADD CONSTRAINT "ResumeExtractionDraft_resumeDocumentId_fkey" FOREIGN KEY ("resumeDocumentId") REFERENCES "ResumeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidateExperience" ADD CONSTRAINT "CandidateExperience_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidateEducation" ADD CONSTRAINT "CandidateEducation_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidateProject" ADD CONSTRAINT "CandidateProject_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidateCertification" ADD CONSTRAINT "CandidateCertification_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidateLanguage" ADD CONSTRAINT "CandidateLanguage_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidateAward" ADD CONSTRAINT "CandidateAward_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidatePublication" ADD CONSTRAINT "CandidatePublication_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidateLink" ADD CONSTRAINT "CandidateLink_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
