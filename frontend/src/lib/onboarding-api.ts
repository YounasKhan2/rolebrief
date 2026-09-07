import { authRequest } from "./auth-api";

export type OnboardingStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";
export type RemotePreference = "REMOTE_ONLY" | "HYBRID" | "ONSITE" | "OPEN_TO_ANY";
export type SeniorityLevel = "ENTRY" | "MID" | "SENIOR" | "LEAD" | "PRINCIPAL" | "DIRECTOR" | "EXECUTIVE";

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
  workAuthorizations: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CandidatePreferenceData {
  id: string;
  targetRoleTitles: string[];
  targetDisciplines: string[];
  remotePreference: RemotePreference;
  preferredCountries: string[];
  preferredCities: string[];
  minSalary: number | null;
  maxSalary: number | null;
  salaryCurrency: string | null;
}

export interface OnboardingProgressData {
  status: OnboardingStatus;
  version: number;
  currentStep: string;
  completedSteps: string[];
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
}

export interface AutosaveOnboardingDto {
  expectedRevision: number;
  currentStep?: string;
  completedSteps?: string[];
  profile?: Partial<{
    headline: string;
    bio: string;
    experienceYears: number;
    seniorityLevel: SeniorityLevel;
    primaryDiscipline: string;
    currentCountry: string;
    currentCity: string;
    workAuthorizations: string[];
  }>;
  preferences?: Partial<{
    targetRoleTitles: string[];
    targetDisciplines: string[];
    remotePreference: RemotePreference;
    preferredCountries: string[];
    preferredCities: string[];
    minSalary: number;
    maxSalary: number;
    salaryCurrency: string;
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

export function skipOnboarding(): Promise<{ status: OnboardingStatus; revision: number }> {
  return authRequest<{ status: OnboardingStatus; revision: number }>("/me/onboarding/skip", {
    method: "POST",
    csrf: true
  });
}

export function completeOnboarding(): Promise<{ status: OnboardingStatus; revision: number }> {
  return authRequest<{ status: OnboardingStatus; revision: number }>("/me/onboarding/complete", {
    method: "POST",
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
