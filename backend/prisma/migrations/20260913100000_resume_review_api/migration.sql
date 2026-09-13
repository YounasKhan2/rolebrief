-- Durable idempotency records for owner-scoped resume review mutations.
CREATE TABLE "ResumeReviewMutation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resumeDocumentId" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseJson" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResumeReviewMutation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResumeReviewMutation_userId_draftId_idempotencyKey_key" ON "ResumeReviewMutation"("userId", "draftId", "idempotencyKey");
CREATE INDEX "ResumeReviewMutation_draftId_createdAt_idx" ON "ResumeReviewMutation"("draftId", "createdAt");
CREATE INDEX "ResumeReviewMutation_expiresAt_idx" ON "ResumeReviewMutation"("expiresAt");
