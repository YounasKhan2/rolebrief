-- CreateEnum
CREATE TYPE "OnboardingStep" AS ENUM ('GOAL', 'REACH', 'FIT', 'REVIEW');

-- CreateEnum
CREATE TYPE "SalaryPeriod" AS ENUM ('HOURLY', 'MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "CandidateSearchStatus" AS ENUM ('ACTIVELY_LOOKING', 'OPEN_TO_OFFERS', 'CASUAL', 'NOT_LOOKING');

-- CreateEnum
CREATE TYPE "RelocationPreference" AS ENUM ('NOT_OPEN', 'WILLING_TO_RELOCATE', 'OPEN_TO_REMOTE_ONLY');

-- AlterTable CandidatePreference
ALTER TABLE "CandidatePreference" ADD COLUMN "employmentTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "relocationPreference" "RelocationPreference",
ADD COLUMN "salaryPeriod" "SalaryPeriod",
ALTER COLUMN "remotePreference" DROP NOT NULL,
ALTER COLUMN "remotePreference" DROP DEFAULT,
ALTER COLUMN "salaryCurrency" DROP DEFAULT;

-- AlterTable CandidateProfile
ALTER TABLE "CandidateProfile" ADD COLUMN "requiresVisaSponsorship" BOOLEAN,
ADD COLUMN "searchStatus" "CandidateSearchStatus",
ADD COLUMN "timezone" TEXT;

-- AlterTable OnboardingProgress
ALTER TABLE "OnboardingProgress" DROP COLUMN "currentStep",
ADD COLUMN "currentStep" "OnboardingStep" NOT NULL DEFAULT 'GOAL',
DROP COLUMN "completedSteps",
ADD COLUMN "completedSteps" "OnboardingStep"[] DEFAULT ARRAY[]::"OnboardingStep"[];
