import { CandidatePreference, CandidateProfile, CandidateSkill } from "@prisma/client";

export interface ProfileCompletenessBreakdown {
  score: number;
  rolesAndDisciplines: number;
  locationAndRemote: number;
  skills: number;
  seniorityAndExperience: number;
  headlineAndBio: number;
}

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
  if (profile.primaryDiscipline || (profile.bio && profile.bio.trim().length >= 10)) {
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
