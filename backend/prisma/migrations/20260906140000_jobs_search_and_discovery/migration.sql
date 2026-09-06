-- Enable pg_trgm extension for trigram similarity search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create composite indexes for keyset sorting & filtering on Job
CREATE INDEX IF NOT EXISTS "Job_status_publishedAt_discoveredAt_id_idx" ON "Job"("status", "publishedAt" DESC NULLS LAST, "discoveredAt" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "Job_status_updatedAt_id_idx" ON "Job"("status", "updatedAt" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "Job_status_applicationDeadlineAt_publishedAt_id_idx" ON "Job"("status", "applicationDeadlineAt" ASC NULLS LAST, "publishedAt" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "Job_status_workMode_idx" ON "Job"("status", "workMode");
CREATE INDEX IF NOT EXISTS "Job_status_remoteScope_idx" ON "Job"("status", "remoteScope");
CREATE INDEX IF NOT EXISTS "Job_status_seniority_idx" ON "Job"("status", "seniority");
CREATE INDEX IF NOT EXISTS "Job_status_employmentType_idx" ON "Job"("status", "employmentType");

-- Create indexes on Salary
CREATE INDEX IF NOT EXISTS "Salary_jobId_idx" ON "Salary"("jobId");
CREATE INDEX IF NOT EXISTS "Salary_currency_min_max_idx" ON "Salary"("currency", "min", "max");

-- Create GIN index for full-text search on Job (combining title, searchDocument, descriptionText)
CREATE INDEX IF NOT EXISTS "Job_fts_idx" ON "Job" USING gin (
  to_tsvector('english', coalesce("canonicalTitle", '') || ' ' || coalesce("searchDocument", '') || ' ' || coalesce("descriptionText", ''))
);

-- Create GIN trigram indexes for partial title & company matching
CREATE INDEX IF NOT EXISTS "Job_canonicalTitle_trgm_idx" ON "Job" USING gin ("canonicalTitle" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Company_canonicalName_trgm_idx" ON "Company" USING gin ("canonicalName" gin_trgm_ops);
