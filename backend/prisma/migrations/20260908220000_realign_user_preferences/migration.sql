-- CreateEnum
CREATE TYPE "MotionPreference" AS ENUM ('SYSTEM', 'REDUCE', 'NO_PREFERENCE');

-- CreateEnum
CREATE TYPE "ContrastPreference" AS ENUM ('SYSTEM', 'HIGH', 'NORMAL');

-- AlterTable UserPreference: add new columns with defaults
ALTER TABLE "UserPreference" ADD COLUMN "motionPreference" "MotionPreference" NOT NULL DEFAULT 'SYSTEM';
ALTER TABLE "UserPreference" ADD COLUMN "contrastPreference" "ContrastPreference" NOT NULL DEFAULT 'SYSTEM';
ALTER TABLE "UserPreference" ADD COLUMN "productUpdatesConsentUpdatedAt" TIMESTAMP(3);
ALTER TABLE "UserPreference" ADD COLUMN "marketingConsentUpdatedAt" TIMESTAMP(3);

-- Map existing boolean values if table has rows
UPDATE "UserPreference"
SET "motionPreference" = CASE WHEN "reducedMotion" = true THEN 'REDUCE'::"MotionPreference" ELSE 'SYSTEM'::"MotionPreference" END,
    "contrastPreference" = CASE WHEN "highContrast" = true THEN 'HIGH'::"ContrastPreference" ELSE 'SYSTEM'::"ContrastPreference" END;

-- Set safe defaults
ALTER TABLE "UserPreference" ALTER COLUMN "productUpdates" SET DEFAULT false;
ALTER TABLE "UserPreference" ALTER COLUMN "marketingEmails" SET DEFAULT false;

-- Drop unsupported columns safely
ALTER TABLE "UserPreference" DROP COLUMN IF EXISTS "reducedMotion";
ALTER TABLE "UserPreference" DROP COLUMN IF EXISTS "highContrast";
ALTER TABLE "UserPreference" DROP COLUMN IF EXISTS "jobAlerts";
ALTER TABLE "UserPreference" DROP COLUMN IF EXISTS "digestCadence";
ALTER TABLE "UserPreference" DROP COLUMN IF EXISTS "quietHoursEnabled";
ALTER TABLE "UserPreference" DROP COLUMN IF EXISTS "quietHoursStart";
ALTER TABLE "UserPreference" DROP COLUMN IF EXISTS "quietHoursEnd";
ALTER TABLE "UserPreference" DROP COLUMN IF EXISTS "privateProfile";
ALTER TABLE "UserPreference" DROP COLUMN IF EXISTS "searchHistoryClearedAt";

-- Drop DigestCadence enum
DROP TYPE IF EXISTS "DigestCadence";
