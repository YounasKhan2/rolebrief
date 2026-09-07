import { authRequest } from "./auth-api";

export type OnboardingStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";
export type OnboardingStep = "GOAL" | "REACH" | "FIT" | "REVIEW";
export type RemotePreference = "REMOTE_ONLY" | "HYBRID" | "ONSITE" | "OPEN_TO_ANY";
export type SeniorityLevel = "ENTRY" | "MID" | "SENIOR" | "LEAD" | "PRINCIPAL" | "DIRECTOR" | "EXECUTIVE";
export type SalaryPeriod = "HOURLY" | "MONTHLY" | "ANNUAL";
export type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP" | "TEMPORARY";
export type CandidateSearchStatus = "ACTIVELY_LOOKING" | "OPEN_TO_OFFERS" | "CASUAL" | "NOT_LOOKING";
export type RelocationPreference = "NOT_OPEN" | "WILLING_TO_RELOCATE" | "OPEN_TO_REMOTE_ONLY";

export interface CandidateSkillItem {
  id?: string;
  displayName: string;
  normalizedName?: string;
  yearsExperience?: number | null;
  isTopSkill?: boolean;
}

export interface CandidateProfileData {
  id: string;
  headline: string | null;
  bio: string | null;
  experienceYears: number | null;
  seniorityLevel: SeniorityLevel | null;
  primaryDiscipline: string | null;
  currentCountry: string | null;
  currentCity: string | null;
  timezone: string | null;
  workAuthorizations: string[];
  requiresVisaSponsorship: boolean | null;
  searchStatus: CandidateSearchStatus | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CandidatePreferenceData {
  id: string;
  targetRoleTitles: string[];
  targetDisciplines: string[];
  remotePreference: RemotePreference | null;
  preferredCountries: string[];
  preferredCities: string[];
  employmentTypes: EmploymentType[];
  relocationPreference: RelocationPreference | null;
  minSalary: number | null;
  maxSalary: number | null;
  salaryCurrency: string | null;
  salaryPeriod: SalaryPeriod | null;
}

export interface OnboardingProgressData {
  status: OnboardingStatus;
  version: number;
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  revision: number;
  startedAt: string | null;
  completedAt: string | null;
  skippedAt: string | null;
  updatedAt: string | null;
}

export interface OnboardingState {
  progress: OnboardingProgressData;
  profile: CandidateProfileData | null;
  preferences: CandidatePreferenceData | null;
  skills: CandidateSkillItem[];
  completeness: number;
  breakdown?: {
    score: number;
    rolesAndDisciplines: number;
    locationAndRemote: number;
    skills: number;
    seniorityAndExperience: number;
    headlineAndBio: number;
  };
  briefCompleteness?: number;
  briefBreakdown?: {
    score: number;
    roles: number;
    location: number;
    skills: number;
    compensationAndPreferences: number;
  };
}

export interface ProfileState {
  profile: CandidateProfileData | null;
  preferences: CandidatePreferenceData | null;
  skills: CandidateSkillItem[];
  completeness: number;
  breakdown?: {
    score: number;
    rolesAndDisciplines: number;
    locationAndRemote: number;
    skills: number;
    seniorityAndExperience: number;
    headlineAndBio: number;
  };
  briefCompleteness?: number;
  briefBreakdown?: {
    score: number;
    roles: number;
    location: number;
    skills: number;
    compensationAndPreferences: number;
  };
}

export interface AutosaveOnboardingDto {
  expectedRevision: number;
  currentStep?: OnboardingStep;
  completedSteps?: OnboardingStep[];
  profile?: Partial<{
    headline: string;
    bio: string;
    experienceYears: number;
    seniorityLevel: SeniorityLevel;
    primaryDiscipline: string;
    currentCountry: string;
    currentCity: string;
    timezone: string;
    workAuthorizations: string[];
    requiresVisaSponsorship: boolean;
    searchStatus: CandidateSearchStatus;
  }>;
  preferences?: Partial<{
    targetRoleTitles: string[];
    targetDisciplines: string[];
    remotePreference: RemotePreference;
    preferredCountries: string[];
    preferredCities: string[];
    employmentTypes: EmploymentType[];
    relocationPreference: RelocationPreference;
    minSalary: number;
    maxSalary: number;
    salaryCurrency: string;
    salaryPeriod: SalaryPeriod;
  }>;
  skills?: CandidateSkillItem[];
}

export function getOnboardingState(): Promise<OnboardingState> {
  return authRequest<OnboardingState>("/me/onboarding");
}

export function autosaveOnboarding(dto: AutosaveOnboardingDto): Promise<OnboardingState> {
  return authRequest<OnboardingState>("/me/onboarding", {
    method: "PUT",
    body: dto,
    csrf: true
  });
}

export function skipOnboarding(opts: { expectedRevision: number }): Promise<{ status: OnboardingStatus; revision: number }> {
  return authRequest<{ status: OnboardingStatus; revision: number }>("/me/onboarding/skip", {
    method: "POST",
    body: opts,
    csrf: true
  });
}

export function completeOnboarding(opts: { expectedRevision: number }): Promise<{ status: OnboardingStatus; revision: number }> {
  return authRequest<{ status: OnboardingStatus; revision: number }>("/me/onboarding/complete", {
    method: "POST",
    body: opts,
    csrf: true
  });
}

export function getProfile(): Promise<ProfileState> {
  return authRequest<ProfileState>("/me/profile");
}

export function updateProfile(payload: {
  profile?: AutosaveOnboardingDto["profile"];
  preferences?: AutosaveOnboardingDto["preferences"];
  skills?: CandidateSkillItem[];
}): Promise<ProfileState> {
  return authRequest<ProfileState>("/me/profile", {
    method: "PATCH",
    body: payload,
    csrf: true
  });
}
