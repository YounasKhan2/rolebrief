import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  calculateOnboardingBriefCompleteness,
  calculateProfileCompleteness
} from "./profile-completeness.util";
import { UpdateCandidateProfilePayloadDto } from "./dto/profile.dto";

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, status: true }
    });
    if (!user) {
      throw new NotFoundException("User not found.");
    }

    const profile = await this.prisma.candidateProfile.findUnique({
      where: { userId },
      include: {
        preferences: true,
        skills: {
          orderBy: [{ isTopSkill: "desc" }, { displayName: "asc" }]
        }
      }
    });

    const completeness = calculateProfileCompleteness(profile);
    const briefCompleteness = calculateOnboardingBriefCompleteness(profile);

    return {
      user,
      profile: profile
        ? {
            id: profile.id,
            headline: profile.headline,
            bio: profile.bio,
            experienceYears: profile.experienceYears,
            seniorityLevel: profile.seniorityLevel,
            primaryDiscipline: profile.primaryDiscipline,
            currentCountry: profile.currentCountry,
            currentCity: profile.currentCity,
            timezone: profile.timezone,
            workAuthorizations: profile.workAuthorizations,
            requiresVisaSponsorship: profile.requiresVisaSponsorship,
            searchStatus: profile.searchStatus,
            createdAt: profile.createdAt,
            updatedAt: profile.updatedAt
          }
        : null,
      preferences: profile?.preferences ?? null,
      skills: profile?.skills ?? [],
      completeness: completeness.score,
      breakdown: completeness,
      briefCompleteness: briefCompleteness.score,
      briefBreakdown: briefCompleteness
    };
  }

  async saveCandidateData(
    userId: string,
    payload: UpdateCandidateProfilePayloadDto,
    externalTx?: Prisma.TransactionClient
  ) {
    const execute = async (tx: Prisma.TransactionClient) => {
      // 1. Upsert CandidateProfile
      const profileData: Prisma.CandidateProfileUpdateInput = {};
      const profileCreateData: Prisma.CandidateProfileCreateInput = {
        user: { connect: { id: userId } }
      };

      if (payload.profile) {
        const p = payload.profile;
        if (p.headline !== undefined) profileData.headline = p.headline;
        if (p.bio !== undefined) profileData.bio = p.bio;
        if (p.experienceYears !== undefined) profileData.experienceYears = p.experienceYears;
        if (p.seniorityLevel !== undefined) profileData.seniorityLevel = p.seniorityLevel;
        if (p.primaryDiscipline !== undefined) profileData.primaryDiscipline = p.primaryDiscipline;
        if (p.currentCountry !== undefined) profileData.currentCountry = p.currentCountry ? p.currentCountry.toUpperCase() : null;
        if (p.currentCity !== undefined) profileData.currentCity = p.currentCity;
        if (p.timezone !== undefined) profileData.timezone = p.timezone;
        if (p.workAuthorizations !== undefined) {
          profileData.workAuthorizations = Array.from(new Set(p.workAuthorizations.map((c) => c.toUpperCase())));
        }
        if (p.requiresVisaSponsorship !== undefined) profileData.requiresVisaSponsorship = p.requiresVisaSponsorship;
        if (p.searchStatus !== undefined) profileData.searchStatus = p.searchStatus;

        Object.assign(profileCreateData, profileData);
      }

      const candidateProfile = await tx.candidateProfile.upsert({
        where: { userId },
        create: profileCreateData,
        update: profileData
      });

      // 2. Upsert CandidatePreference
      if (payload.preferences) {
        const pref = payload.preferences;
        const prefData: Prisma.CandidatePreferenceUpdateInput = {};
        const prefCreateData: Prisma.CandidatePreferenceCreateInput = {
          profile: { connect: { id: candidateProfile.id } }
        };

        if (pref.targetRoleTitles !== undefined) prefData.targetRoleTitles = pref.targetRoleTitles;
        if (pref.targetDisciplines !== undefined) prefData.targetDisciplines = pref.targetDisciplines;
        if (pref.remotePreference !== undefined) prefData.remotePreference = pref.remotePreference;
        if (pref.preferredCountries !== undefined) {
          prefData.preferredCountries = Array.from(new Set(pref.preferredCountries.map((c) => c.toUpperCase())));
        }
        if (pref.preferredCities !== undefined) prefData.preferredCities = pref.preferredCities;
        if (pref.employmentTypes !== undefined) prefData.employmentTypes = pref.employmentTypes;
        if (pref.relocationPreference !== undefined) prefData.relocationPreference = pref.relocationPreference;
        if (pref.minSalary !== undefined) prefData.minSalary = pref.minSalary;
        if (pref.maxSalary !== undefined) prefData.maxSalary = pref.maxSalary;
        if (pref.salaryCurrency !== undefined) prefData.salaryCurrency = pref.salaryCurrency;
        if (pref.salaryPeriod !== undefined) prefData.salaryPeriod = pref.salaryPeriod;

        Object.assign(prefCreateData, prefData);

        await tx.candidatePreference.upsert({
          where: { profileId: candidateProfile.id },
          create: prefCreateData,
          update: prefData
        });
      }

      // 3. Sync CandidateSkills if provided
      if (payload.skills !== undefined) {
        // Normalize skill names
        const seen = new Set<string>();
        const uniqueSkills = payload.skills.filter((s) => {
          const norm = s.displayName.trim().toLowerCase();
          if (!norm || seen.has(norm)) return false;
          seen.add(norm);
          return true;
        });

        // Delete existing skills not in the new list
        const activeNormalizedNames = uniqueSkills.map((s) => s.displayName.trim().toLowerCase());
        await tx.candidateSkill.deleteMany({
          where: {
            profileId: candidateProfile.id,
            normalizedName: { notIn: activeNormalizedNames }
          }
        });

        // Upsert each skill
        for (const s of uniqueSkills) {
          const norm = s.displayName.trim().toLowerCase();
          await tx.candidateSkill.upsert({
            where: {
              profileId_normalizedName: {
                profileId: candidateProfile.id,
                normalizedName: norm
              }
            },
            create: {
              profile: { connect: { id: candidateProfile.id } },
              displayName: s.displayName.trim(),
              normalizedName: norm,
              yearsExperience: s.yearsExperience,
              isTopSkill: s.isTopSkill ?? false
            },
            update: {
              displayName: s.displayName.trim(),
              yearsExperience: s.yearsExperience,
              isTopSkill: s.isTopSkill ?? false
            }
          });
        }
      }

      // Return full updated candidate profile
      return tx.candidateProfile.findUniqueOrThrow({
        where: { id: candidateProfile.id },
        include: {
          preferences: true,
          skills: {
            orderBy: [{ isTopSkill: "desc" }, { displayName: "asc" }]
          }
        }
      });
    };

    if (externalTx) {
      return execute(externalTx);
    }
    return this.prisma.$transaction(execute);
  }

  async updateProfile(userId: string, payload: UpdateCandidateProfilePayloadDto) {
    const updated = await this.saveCandidateData(userId, payload);
    const completeness = calculateProfileCompleteness(updated);
    const briefCompleteness = calculateOnboardingBriefCompleteness(updated);

    return {
      profile: {
        id: updated.id,
        headline: updated.headline,
        bio: updated.bio,
        experienceYears: updated.experienceYears,
        seniorityLevel: updated.seniorityLevel,
        primaryDiscipline: updated.primaryDiscipline,
        currentCountry: updated.currentCountry,
        currentCity: updated.currentCity,
        timezone: updated.timezone,
        workAuthorizations: updated.workAuthorizations,
        requiresVisaSponsorship: updated.requiresVisaSponsorship,
        searchStatus: updated.searchStatus,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt
      },
      preferences: updated.preferences,
      skills: updated.skills,
      completeness: completeness.score,
      breakdown: completeness,
      briefCompleteness: briefCompleteness.score,
      briefBreakdown: briefCompleteness
    };
  }
}
