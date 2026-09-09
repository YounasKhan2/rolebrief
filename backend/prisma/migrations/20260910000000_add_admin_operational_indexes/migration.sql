-- CreateIndex
CREATE INDEX "Job_moderationState_status_discoveredAt_idx" ON "Job"("moderationState", "status", "discoveredAt");

-- CreateIndex
CREATE INDEX "IngestionRun_status_startedAt_idx" ON "IngestionRun"("status", "startedAt");
