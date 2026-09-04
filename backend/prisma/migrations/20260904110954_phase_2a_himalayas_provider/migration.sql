-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "logoUrl" TEXT;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "sourceId" TEXT;

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "alpha2" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobLocation" (
    "jobId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,

    CONSTRAINT "JobLocation_pkey" PRIMARY KEY ("jobId","locationId")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "attributionPolicy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderRecord" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "jobId" TEXT,
    "companyId" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "applicationUrl" TEXT,
    "rawPayload" JSONB NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "providerPublishedAt" TIMESTAMP(3),
    "providerUpdatedAt" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observedState" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "ProviderRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Location_slug_key" ON "Location"("slug");

-- CreateIndex
CREATE INDEX "Location_name_idx" ON "Location"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Source_slug_key" ON "Source"("slug");

-- CreateIndex
CREATE INDEX "ProviderRecord_jobId_idx" ON "ProviderRecord"("jobId");

-- CreateIndex
CREATE INDEX "ProviderRecord_companyId_idx" ON "ProviderRecord"("companyId");

-- CreateIndex
CREATE INDEX "ProviderRecord_providerId_fetchedAt_idx" ON "ProviderRecord"("providerId", "fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderRecord_providerId_externalId_recordType_key" ON "ProviderRecord"("providerId", "externalId", "recordType");

-- CreateIndex
CREATE INDEX "Job_sourceId_idx" ON "Job"("sourceId");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobLocation" ADD CONSTRAINT "JobLocation_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobLocation" ADD CONSTRAINT "JobLocation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderRecord" ADD CONSTRAINT "ProviderRecord_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderRecord" ADD CONSTRAINT "ProviderRecord_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderRecord" ADD CONSTRAINT "ProviderRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
