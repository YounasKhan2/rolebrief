import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { OnboardingStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ProfileService } from "../profile/profile.service";
import { calculateProfileCompleteness } from "../profile/profile-completeness.util";
import { AutosaveOnboardingDto } from "./dto/onboarding.dto";

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profileService: ProfileService
  ) {}

  async getOnboardingState(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, status: true }
    });
    if (!user) {
      throw new NotFoundException("User not found.");
    }

    const progress = await this.prisma.onboardingProgress.findUnique({
      where: { userId }
    });

    const candidate = await this.prisma.candidateProfile.findUnique({
      where: { userId },
      include: {
        preferences: true,
        skills: {
          orderBy: [{ isTopSkill: "desc" }, { displayName: "asc" }]
        }
      }
    });

    const completeness = calculateProfileCompleteness(candidate);

    return {
      user,
      progress: progress
        ? {
            status: progress.status,
            version: progress.version,
            currentStep: progress.currentStep,
            completedSteps: progress.completedSteps,
            revision: progress.revision,
            startedAt: progress.startedAt,
            completedAt: progress.completedAt,
            skippedAt: progress.skippedAt,
            updatedAt: progress.updatedAt
          }
        : {
            status: OnboardingStatus.NOT_STARTED,
            version: 1,
            currentStep: "role",
            completedSteps: [],
            revision: 0,
            startedAt: null,
            completedAt: null,
            skippedAt: null,
            updatedAt: null
          },
      profile: candidate
        ? {
            id: candidate.id,
            headline: candidate.headline,
            bio: candidate.bio,
            experienceYears: candidate.experienceYears,
            seniorityLevel: candidate.seniorityLevel,
            primaryDiscipline: candidate.primaryDiscipline,
            currentCountry: candidate.currentCountry,
            currentCity: candidate.currentCity,
            workAuthorizations: candidate.workAuthorizations
          }
        : null,
      preferences: candidate?.preferences ?? null,
      skills: candidate?.skills ?? [],
      completeness: completeness.score,
      breakdown: completeness
    };
  }

  async autosave(userId: string, dto: AutosaveOnboardingDto) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Check current progress for optimistic concurrency revision
      const existing = await tx.onboardingProgress.findUnique({
        where: { userId }
      });

      const currentDbRevision = existing ? existing.revision : 0;
      if (dto.expectedRevision !== currentDbRevision) {
        throw new ConflictException({
          message: "Optimistic concurrency conflict: onboarding data was modified in another session.",
          expectedRevision: dto.expectedRevision,
          currentRevision: currentDbRevision
        });
      }

      // 2. Save candidate profile, preferences, and skills if any provided
      if (dto.profile || dto.preferences || dto.skills !== undefined) {
        await this.profileService.saveCandidateData(
          userId,
          {
            profile: dto.profile,
            preferences: dto.preferences,
            skills: dto.skills
          },
          tx
        );
      }

      // 3. Upsert OnboardingProgress
      const nextRevision = currentDbRevision + 1;
      const nextCompletedSteps = dto.completedSteps !== undefined
        ? Array.from(new Set(dto.completedSteps))
        : (existing?.completedSteps ?? []);
      const nextStep = dto.currentStep ?? existing?.currentStep ?? "role";

      let nextStatus = existing?.status ?? OnboardingStatus.IN_PROGRESS;
      if (nextStatus === OnboardingStatus.NOT_STARTED) {
        nextStatus = OnboardingStatus.IN_PROGRESS;
      }

      const updatedProgress = await tx.onboardingProgress.upsert({
        where: { userId },
        create: {
          userId,
          status: OnboardingStatus.IN_PROGRESS,
          version: 1,
          currentStep: nextStep,
          completedSteps: nextCompletedSteps,
          revision: nextRevision,
          startedAt: new Date()
        },
        update: {
          status: nextStatus,
          currentStep: nextStep,
          completedSteps: nextCompletedSteps,
          revision: nextRevision,
          startedAt: existing?.startedAt ?? new Date()
        }
      });

      // 4. Fetch full updated candidate state
      const candidate = await tx.candidateProfile.findUnique({
        where: { userId },
        include: {
          preferences: true,
          skills: {
            orderBy: [{ isTopSkill: "desc" }, { displayName: "asc" }]
          }
        }
      });

      const completeness = calculateProfileCompleteness(candidate);

      return {
        progress: {
          status: updatedProgress.status,
          version: updatedProgress.version,
          currentStep: updatedProgress.currentStep,
          completedSteps: updatedProgress.completedSteps,
          revision: updatedProgress.revision,
          startedAt: updatedProgress.startedAt,
          completedAt: updatedProgress.completedAt,
          skippedAt: updatedProgress.skippedAt,
          updatedAt: updatedProgress.updatedAt
        },
        profile: candidate
          ? {
              id: candidate.id,
              headline: candidate.headline,
              bio: candidate.bio,
              experienceYears: candidate.experienceYears,
              seniorityLevel: candidate.seniorityLevel,
              primaryDiscipline: candidate.primaryDiscipline,
              currentCountry: candidate.currentCountry,
              currentCity: candidate.currentCity,
              workAuthorizations: candidate.workAuthorizations
            }
          : null,
        preferences: candidate?.preferences ?? null,
        skills: candidate?.skills ?? [],
        completeness: completeness.score,
        breakdown: completeness
      };
    });
  }

  async skip(userId: string) {
    const existing = await this.prisma.onboardingProgress.findUnique({
      where: { userId }
    });

    const nextRevision = (existing?.revision ?? 0) + 1;
    const progress = await this.prisma.onboardingProgress.upsert({
      where: { userId },
      create: {
        userId,
        status: OnboardingStatus.SKIPPED,
        version: 1,
        revision: nextRevision,
        skippedAt: new Date()
      },
      update: {
        status: OnboardingStatus.SKIPPED,
        revision: nextRevision,
        skippedAt: new Date()
      }
    });

    return {
      status: progress.status,
      revision: progress.revision,
      skippedAt: progress.skippedAt
    };
  }

  async complete(userId: string) {
    const existing = await this.prisma.onboardingProgress.findUnique({
      where: { userId }
    });

    const nextRevision = (existing?.revision ?? 0) + 1;
    const progress = await this.prisma.onboardingProgress.upsert({
      where: { userId },
      create: {
        userId,
        status: OnboardingStatus.COMPLETED,
        version: 1,
        revision: nextRevision,
        completedAt: new Date(),
        completedSteps: ["role", "location", "skills", "preferences"]
      },
      update: {
        status: OnboardingStatus.COMPLETED,
        revision: nextRevision,
        completedAt: new Date(),
        completedSteps: Array.from(new Set([...(existing?.completedSteps ?? []), "role", "location", "skills", "preferences"]))
      }
    });

    return {
      status: progress.status,
      revision: progress.revision,
      completedAt: progress.completedAt
    };
  }
}
