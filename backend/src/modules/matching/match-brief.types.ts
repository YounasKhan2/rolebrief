import { EmploymentType, RemotePreference, SalaryPeriod, SeniorityLevel, WorkMode } from "@prisma/client";

export interface CandidateMatchFacts {
  userId: string;
  revision: number;
  targetRoleTitles: string[];
  seniorityLevel: SeniorityLevel | null;
  remotePreference: RemotePreference | null;
  employmentTypes: EmploymentType[];
  minSalary: number | null;
  maxSalary: number | null;
  salaryCurrency: string | null;
  salaryPeriod: SalaryPeriod | null;
}

export interface JobMatchFacts {
  id: string;
  slug: string;
  title: string;
  seniority: string | null;
  employmentType: string | null;
  workMode: WorkMode;
  salary: {
    min: number | null;
    max: number | null;
    currency: string | null;
    period: string | null;
  } | null;
}

