import { CandidatePreference, CandidateProfile, CandidateSkill } from "@prisma/client";

export interface ProfileCompletenessBreakdown {
  score: number;
  rolesAndDisciplines: number;
  locationAndRemote: number;
  skills: number;
  seniorityAndExperience: number;
  headlineAndBio: number;
}

export interface OnboardingBriefCompletenessBreakdown {
  score: number;
  roles: number;
  location: number;
  skills: number;
  compensationAndPreferences: number;
}

/**
 * Calculates the opportunity brief completeness based strictly on what is
 * asked and configured during the 4-step candidate onboarding wizard.
 * Headline/bio are NOT required for a 100% complete opportunity brief.
 */
export function calculateOnboardingBriefCompleteness(
  profile?: (CandidateProfile & { preferences?: CandidatePreference | null; skills?: CandidateSkill[] }) | null
): OnboardingBriefCompletenessBreakdown {
  if (!profile) {
    return {
      score: 0,
      roles: 0,
      location: 0,
      skills: 0,
      compensationAndPreferences: 0
    };
  }

  const preferences = profile.preferences;
  const skills = profile.skills ?? [];

  // 1. Roles & Disciplines (max 25%)
  let roles = 0;
  if (preferences?.targetRoleTitles && preferences.targetRoleTitles.length > 0) {
    roles += 15;
  }
  if ((preferences?.targetDisciplines && preferences.targetDisciplines.length > 0) || profile.seniorityLevel) {
    roles += 10;
  }

  // 2. Location, Remote & Work Authorizations (max 25%)
  let location = 0;
  if (profile.currentCountry) {
    location += 10;
  }
  if (profile.workAuthorizations && profile.workAuthorizations.length > 0) {
    location += 5;
  }
  if (preferences?.remotePreference) {
    location += 10;
  }

  // 3. Verified Skills (max 25%)
  let skillsScore = 0;
  if (skills.length >= 1) {
    skillsScore += 10;
  }
  if (skills.length >= 3) {
    skillsScore += 15;
  }

  // 4. Compensation, Employment Type & Relocation (max 25%)
  let compensationAndPreferences = 0;
  if (preferences?.minSalary !== null && preferences?.minSalary !== undefined) {
    compensationAndPreferences += 10;
  }
  if (preferences?.employmentTypes && preferences.employmentTypes.length > 0) {
    compensationAndPreferences += 10;
  }
  if (preferences?.relocationPreference || preferences?.salaryCurrency) {
    compensationAndPreferences += 5;
  }

  const score = Math.min(100, roles + location + skillsScore + compensationAndPreferences);

  return {
    score,
    roles,
    location,
    skills: skillsScore,
    compensationAndPreferences
  };
}

/**
 * Calculates the full comprehensive candidate profile completeness across all
 * profile dimensions (including headline, bio, experience, and search status).
 */
export function calculateProfileCompleteness(
  profile?: (CandidateProfile & { preferences?: CandidatePreference | null; skills?: CandidateSkill[] }) | null
): ProfileCompletenessBreakdown {
  if (!profile) {
    return {
      score: 0,
      rolesAndDisciplines: 0,
      locationAndRemote: 0,
      skills: 0,
      seniorityAndExperience: 0,
      headlineAndBio: 0
    };
  }

  const preferences = profile.preferences;
  const skills = profile.skills ?? [];

  let rolesAndDisciplines = 0;
  if (preferences?.targetRoleTitles && preferences.targetRoleTitles.length > 0) {
    rolesAndDisciplines += 15;
  }
  if (preferences?.targetDisciplines && preferences.targetDisciplines.length > 0) {
    rolesAndDisciplines += 10;
  }

  let locationAndRemote = 0;
  if (profile.currentCountry || (preferences?.preferredCountries && preferences.preferredCountries.length > 0)) {
    locationAndRemote += 10;
  }
  if (preferences?.remotePreference) {
    locationAndRemote += 10;
  }

  let skillsScore = 0;
  if (skills.length >= 1) {
    skillsScore += 10;
  }
  if (skills.length >= 3) {
    skillsScore += 15;
  }

  let seniorityAndExperience = 0;
  if (profile.seniorityLevel) {
    seniorityAndExperience += 10;
  }
  if (profile.experienceYears !== null && profile.experienceYears !== undefined) {
    seniorityAndExperience += 5;
  }

  let headlineAndBio = 0;
  if (profile.headline && profile.headline.trim().length >= 3) {
    headlineAndBio += 10;
  }
  if (profile.bio && profile.bio.trim().length >= 10) {
    headlineAndBio += 5;
  }

  const score = Math.min(100, rolesAndDisciplines + locationAndRemote + skillsScore + seniorityAndExperience + headlineAndBio);

  return {
    score,
    rolesAndDisciplines,
    locationAndRemote,
    skills: skillsScore,
    seniorityAndExperience,
    headlineAndBio
  };
}
