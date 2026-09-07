-- Align SalaryPeriod enum from YEARLY to ANNUAL
ALTER TYPE "SalaryPeriod" RENAME VALUE 'YEARLY' TO 'ANNUAL';

-- Create EmploymentType enum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'TEMPORARY');

-- Convert CandidatePreference.employmentTypes from text[] to EmploymentType[]
ALTER TABLE "CandidatePreference" ALTER COLUMN "employmentTypes" DROP DEFAULT;
ALTER TABLE "CandidatePreference" ALTER COLUMN "employmentTypes" TYPE "EmploymentType"[] USING "employmentTypes"::text[]::"EmploymentType"[];
ALTER TABLE "CandidatePreference" ALTER COLUMN "employmentTypes" SET DEFAULT ARRAY[]::"EmploymentType"[];
