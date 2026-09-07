-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "RemotePreference" AS ENUM ('REMOTE_ONLY', 'HYBRID', 'ONSITE', 'OPEN_TO_ANY');

-- CreateEnum
CREATE TYPE "SeniorityLevel" AS ENUM ('ENTRY', 'MID', 'SENIOR', 'LEAD', 'PRINCIPAL', 'DIRECTOR', 'EXECUTIVE');

-- CreateTable
CREATE TABLE "OnboardingProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "OnboardingStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "currentStep" TEXT NOT NULL DEFAULT 'role',
    "completedSteps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "revision" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "skippedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "headline" TEXT,
    "bio" TEXT,
    "experienceYears" INTEGER,
    "seniorityLevel" "SeniorityLevel",
    "primaryDiscipline" TEXT,
    "currentCountry" TEXT,
    "currentCity" TEXT,
    "workAuthorizations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidatePreference" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "targetRoleTitles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetDisciplines" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "remotePreference" "RemotePreference" NOT NULL DEFAULT 'OPEN_TO_ANY',
    "preferredCountries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredCities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "minSalary" INTEGER,
    "maxSalary" INTEGER,
    "salaryCurrency" TEXT DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidatePreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateSkill" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "yearsExperience" INTEGER,
    "isTopSkill" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateSkill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingProgress_userId_key" ON "OnboardingProgress"("userId");

-- CreateIndex
CREATE INDEX "OnboardingProgress_status_idx" ON "OnboardingProgress"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateProfile_userId_key" ON "CandidateProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidatePreference_profileId_key" ON "CandidatePreference"("profileId");

-- CreateIndex
CREATE INDEX "CandidateSkill_normalizedName_idx" ON "CandidateSkill"("normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateSkill_profileId_normalizedName_key" ON "CandidateSkill"("profileId", "normalizedName");

-- AddForeignKey
ALTER TABLE "OnboardingProgress" ADD CONSTRAINT "OnboardingProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidatePreference" ADD CONSTRAINT "CandidatePreference_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateSkill" ADD CONSTRAINT "CandidateSkill_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
