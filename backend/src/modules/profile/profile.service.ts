import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, SkillSource } from "@prisma/client";
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
      select: { id: true, name: true, email: true, role: true, status: true, timezone: true }
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
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        timezone: user.timezone
      },
      profile: profile
        ? {
            id: profile.id,
            headline: profile.headline,
            bio: profile.bio,
            experienceYears: profile.experienceYears,
            seniorityLevel: profile.seniorityLevel,
            currentCountry: profile.currentCountry,
            currentCity: profile.currentCity,
            timezone: user.timezone,
            workAuthorizations: profile.workAuthorizations,
            requiresVisaSponsorship: profile.requiresVisaSponsorship,
            searchStatus: profile.searchStatus,
            revision: profile.revision,
            createdAt: profile.createdAt,
            updatedAt: profile.updatedAt
          }
        : null,
      preferences: profile?.preferences ?? null,
      skills: profile?.skills ?? [],
      profileRevision: profile?.revision ?? 0,
      revision: profile?.revision ?? 0,
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
    if (payload.expectedRevision === undefined || payload.expectedRevision === null) {
      throw new BadRequestException("expectedRevision is required for candidate profile mutations.");
    }

    const execute = async (tx: Prisma.TransactionClient) => {
      // 1. Optimistic concurrency check on CandidateProfile
      const existing = await tx.candidateProfile.findUnique({
        where: { userId }
      });

      if (!existing && payload.expectedRevision !== 0) {
        const currentState = await this.getProfile(userId).catch(() => null);
        throw new ConflictException({
          message: "Optimistic concurrency conflict: candidate profile does not exist for the expected revision.",
          expectedRevision: payload.expectedRevision,
          currentRevision: 0,
          currentState
        });
      }

      if (existing && existing.revision !== payload.expectedRevision) {
        const currentState = await this.getProfile(userId).catch(() => null);
        throw new ConflictException({
          message: "Optimistic concurrency conflict: candidate profile was modified in another session.",
          expectedRevision: payload.expectedRevision,
          currentRevision: existing.revision,
          currentState
        });
      }

      // 2. Canonical Timezone Sync: update User.timezone if specified
      if (payload.profile?.timezone && payload.profile.timezone.trim()) {
        await tx.user.update({
          where: { id: userId },
          data: { timezone: payload.profile.timezone.trim() }
        });
      }

      // 3. Upsert CandidateProfile with atomic revision bump
      const nextRevision = (existing?.revision ?? 0) + 1;
      const profileData: Prisma.CandidateProfileUpdateInput = {
        revision: nextRevision
      };
      const profileCreateData: Prisma.CandidateProfileCreateInput = {
        user: { connect: { id: userId } },
        revision: nextRevision
      };

      if (payload.profile) {
        const p = payload.profile;
        if (p.headline !== undefined) profileData.headline = p.headline;
        if (p.bio !== undefined) profileData.bio = p.bio;
        if (p.experienceYears !== undefined) profileData.experienceYears = p.experienceYears;
        if (p.seniorityLevel !== undefined) profileData.seniorityLevel = p.seniorityLevel;
        if (p.currentCountry !== undefined) profileData.currentCountry = p.currentCountry ? p.currentCountry.toUpperCase() : null;
        if (p.currentCity !== undefined) profileData.currentCity = p.currentCity;
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

      // 4. Upsert CandidatePreference
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

      // 5. Source-Isolated Skill Sync
      if (payload.skills !== undefined) {
        const seen = new Set<string>();
        const uniqueSkills: { displayName: string; normalizedName: string; yearsExperience?: number; isTopSkill?: boolean }[] = [];

        for (const s of payload.skills) {
          const cleanedDisplay = s.displayName.trim().replace(/\s+/g, " ").normalize("NFKC");
          const norm = cleanedDisplay.toLowerCase();
          if (!norm || seen.has(norm)) continue;
          seen.add(norm);
          uniqueSkills.push({
            displayName: cleanedDisplay,
            normalizedName: norm,
            yearsExperience: s.yearsExperience,
            isTopSkill: s.isTopSkill ?? false
          });
        }

        const activeNormalizedNames = uniqueSkills.map((s) => s.normalizedName);

        // Delete only USER_DECLARED skills not in active list (preserving parser/inferred skills)
        await tx.candidateSkill.deleteMany({
          where: {
            profileId: candidateProfile.id,
            source: SkillSource.USER_DECLARED,
            normalizedName: { notIn: activeNormalizedNames }
          }
        });

        // Upsert each skill preserving provenance
        for (const s of uniqueSkills) {
          await tx.candidateSkill.upsert({
            where: {
              profileId_normalizedName: {
                profileId: candidateProfile.id,
                normalizedName: s.normalizedName
              }
            },
            create: {
              profile: { connect: { id: candidateProfile.id } },
              displayName: s.displayName,
              normalizedName: s.normalizedName,
              yearsExperience: s.yearsExperience,
              isTopSkill: s.isTopSkill ?? false,
              source: SkillSource.USER_DECLARED
            },
            update: {
              displayName: s.displayName,
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
          user: { select: { id: true, name: true, email: true, role: true, status: true, timezone: true } },
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
      user: {
        id: updated.user.id,
        name: updated.user.name,
        email: updated.user.email,
        role: updated.user.role,
        status: updated.user.status,
        timezone: updated.user.timezone
      },
      profile: {
        id: updated.id,
        headline: updated.headline,
        bio: updated.bio,
        experienceYears: updated.experienceYears,
        seniorityLevel: updated.seniorityLevel,
        currentCountry: updated.currentCountry,
        currentCity: updated.currentCity,
        timezone: updated.user.timezone,
        workAuthorizations: updated.workAuthorizations,
        requiresVisaSponsorship: updated.requiresVisaSponsorship,
        searchStatus: updated.searchStatus,
        revision: updated.revision,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt
      },
      preferences: updated.preferences,
      skills: updated.skills,
      profileRevision: updated.revision,
      revision: updated.revision,
      completeness: completeness.score,
      breakdown: completeness,
      briefCompleteness: briefCompleteness.score,
      briefBreakdown: briefCompleteness
    };
  }
}
