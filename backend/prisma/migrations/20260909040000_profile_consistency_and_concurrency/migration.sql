-- CreateEnum
CREATE TYPE "SkillSource" AS ENUM ('USER_DECLARED', 'RESUME_PARSED', 'INFERRED');

-- AlterTable CandidateProfile: add revision
ALTER TABLE "CandidateProfile" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;

-- AlterTable CandidateSkill: add source
ALTER TABLE "CandidateSkill" ADD COLUMN "source" "SkillSource" NOT NULL DEFAULT 'USER_DECLARED';

-- Backfill User.timezone from CandidateProfile.timezone where User.timezone is still UTC or empty
UPDATE "User" u
SET "timezone" = cp."timezone"
FROM "CandidateProfile" cp
WHERE cp."userId" = u."id"
  AND cp."timezone" IS NOT NULL
  AND cp."timezone" != ''
  AND (u."timezone" = 'UTC' OR u."timezone" IS NULL OR u."timezone" = '');

-- Backfill CandidatePreference.targetDisciplines from CandidateProfile.primaryDiscipline where targetDisciplines is empty
UPDATE "CandidatePreference" cp
SET "targetDisciplines" = ARRAY[cprof."primaryDiscipline"]::TEXT[]
FROM "CandidateProfile" cprof
WHERE cp."profileId" = cprof."id"
  AND cprof."primaryDiscipline" IS NOT NULL
  AND cprof."primaryDiscipline" != ''
  AND (cp."targetDisciplines" IS NULL OR cardinality(cp."targetDisciplines") = 0);

-- Drop duplicate columns from CandidateProfile
ALTER TABLE "CandidateProfile" DROP COLUMN IF EXISTS "timezone";
ALTER TABLE "CandidateProfile" DROP COLUMN IF EXISTS "primaryDiscipline";
