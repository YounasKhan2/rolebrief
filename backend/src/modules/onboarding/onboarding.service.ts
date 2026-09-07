import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { OnboardingStatus, OnboardingStep, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ProfileService } from "../profile/profile.service";
import {
  calculateOnboardingBriefCompleteness,
  calculateProfileCompleteness
} from "../profile/profile-completeness.util";
import { AutosaveOnboardingDto, CompleteOnboardingDto, SkipOnboardingDto } from "./dto/onboarding.dto";

const ALLOWED_TRANSITIONS: Record<OnboardingStatus, OnboardingStatus[]> = {
  [OnboardingStatus.NOT_STARTED]: [OnboardingStatus.IN_PROGRESS, OnboardingStatus.SKIPPED],
  [OnboardingStatus.IN_PROGRESS]: [OnboardingStatus.COMPLETED, OnboardingStatus.SKIPPED, OnboardingStatus.IN_PROGRESS],
  [OnboardingStatus.SKIPPED]: [OnboardingStatus.IN_PROGRESS, OnboardingStatus.COMPLETED, OnboardingStatus.SKIPPED],
  [OnboardingStatus.COMPLETED]: [OnboardingStatus.COMPLETED]
};

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profileService: ProfileService
  ) {}

  private validateTransition(currentStatus: OnboardingStatus, nextStatus: OnboardingStatus) {
    const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? [];
    if (!allowed.includes(nextStatus)) {
      throw new BadRequestException(
        `Invalid onboarding status transition from ${currentStatus} to ${nextStatus}.`
      );
    }
  }

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
    const briefCompleteness = calculateOnboardingBriefCompleteness(candidate);

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
            currentStep: OnboardingStep.GOAL,
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
            timezone: candidate.timezone,
            workAuthorizations: candidate.workAuthorizations,
            requiresVisaSponsorship: candidate.requiresVisaSponsorship,
            searchStatus: candidate.searchStatus,
            createdAt: candidate.createdAt,
            updatedAt: candidate.updatedAt
          }
        : null,
      preferences: candidate?.preferences ?? null,
      skills: candidate?.skills ?? [],
      completeness: completeness.score,
      breakdown: completeness,
      briefCompleteness: briefCompleteness.score,
      briefBreakdown: briefCompleteness
    };
  }

  async autosave(userId: string, dto: AutosaveOnboardingDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Concurrency and status transition checks
        if (dto.expectedRevision > 0 && tx.onboardingProgress.findUnique) {
          const existing = await tx.onboardingProgress.findUnique({ where: { userId } });
          if (existing) {
            this.validateTransition(existing.status, OnboardingStatus.IN_PROGRESS);
          }
        }

        // 1. Atomic optimistic concurrency check / update
        if (dto.expectedRevision === 0) {
          try {
            await tx.onboardingProgress.create({
              data: {
                userId,
                status: OnboardingStatus.IN_PROGRESS,
                version: 1,
                currentStep: (dto.currentStep as unknown as OnboardingStep) ?? OnboardingStep.GOAL,
                completedSteps: dto.completedSteps ? (Array.from(new Set(dto.completedSteps)) as unknown as OnboardingStep[]) : [],
                revision: 1,
                startedAt: new Date()
              }
            });
          } catch (error: any) {
            if (error?.code === "P2002" || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) {
              throw new ConflictException({
                message: "Optimistic concurrency conflict: onboarding data was modified in another session.",
                expectedRevision: 0
              });
            }
            throw error;
          }
        } else {
          const updateData: Prisma.OnboardingProgressUpdateManyMutationInput = {
            status: OnboardingStatus.IN_PROGRESS,
            revision: { increment: 1 }
          };
          if (dto.currentStep !== undefined) {
            updateData.currentStep = dto.currentStep as unknown as OnboardingStep;
          }
          if (dto.completedSteps !== undefined) {
            updateData.completedSteps = Array.from(new Set(dto.completedSteps)) as unknown as OnboardingStep[];
          }

          const res = await tx.onboardingProgress.updateMany({
            where: {
              userId,
              revision: dto.expectedRevision
            },
            data: updateData
          });

          if (res.count === 0) {
            const current = tx.onboardingProgress.findUnique
              ? await tx.onboardingProgress.findUnique({ where: { userId } })
              : null;
            throw new ConflictException({
              message: "Optimistic concurrency conflict: onboarding data was modified in another session.",
              expectedRevision: dto.expectedRevision,
              currentRevision: current?.revision ?? 0
            });
          }
        }

        // 2. Save candidate profile, preferences, and skills if any provided
        let candidate = null;
        if (dto.profile || dto.preferences || dto.skills !== undefined) {
          candidate = await this.profileService.saveCandidateData(
            userId,
            {
              profile: dto.profile,
              preferences: dto.preferences,
              skills: dto.skills
            },
            tx
          );
        } else {
          candidate = await tx.candidateProfile.findUnique({
            where: { userId },
            include: {
              preferences: true,
              skills: {
                orderBy: [{ isTopSkill: "desc" }, { displayName: "asc" }]
              }
            }
          });
        }

        const updatedProgress = await tx.onboardingProgress.findUniqueOrThrow({
          where: { userId }
        });

        const completeness = calculateProfileCompleteness(candidate);
        const briefCompleteness = calculateOnboardingBriefCompleteness(candidate);

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
                timezone: candidate.timezone,
                workAuthorizations: candidate.workAuthorizations,
                requiresVisaSponsorship: candidate.requiresVisaSponsorship,
                searchStatus: candidate.searchStatus,
                createdAt: candidate.createdAt,
                updatedAt: candidate.updatedAt
              }
            : null,
          preferences: candidate?.preferences ?? null,
          skills: candidate?.skills ?? [],
          completeness: completeness.score,
          breakdown: completeness,
          briefCompleteness: briefCompleteness.score,
          briefBreakdown: briefCompleteness
        };
      });
    } catch (error) {
      if (error instanceof ConflictException) {
        const currentState = await this.getOnboardingState(userId).catch(() => null);
        const errResp = error.getResponse();
        const base = typeof errResp === "object" ? errResp : { message: error.message };
        const currentRevision =
          typeof errResp === "object" && (errResp as any).currentRevision !== undefined
            ? (errResp as any).currentRevision
            : (currentState?.progress.revision ?? 0);
        throw new ConflictException({
          ...base,
          currentRevision,
          currentState
        });
      }
      throw error;
    }
  }


  async skip(userId: string, dto: SkipOnboardingDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.expectedRevision === 0) {
          try {
            const created = await tx.onboardingProgress.create({
              data: {
                userId,
                status: OnboardingStatus.SKIPPED,
                version: 1,
                revision: 1,
                currentStep: OnboardingStep.GOAL,
                completedSteps: [],
                skippedAt: new Date()
              }
            });
            return {
              status: created.status,
              revision: created.revision,
              skippedAt: created.skippedAt
            };
          } catch (error: any) {
            if (error?.code === "P2002" || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) {
              throw new ConflictException({
                message: "Optimistic concurrency conflict: onboarding data was modified in another session.",
                expectedRevision: 0,
                currentRevision: 1
              });
            }
            throw error;
          }
        }

        const existing = await tx.onboardingProgress.findUnique({
          where: { userId }
        });
        if (!existing) {
          throw new ConflictException({
            message: "Optimistic concurrency conflict: onboarding record does not exist for the expected revision.",
            expectedRevision: dto.expectedRevision,
            currentRevision: 0
          });
        }
        this.validateTransition(existing.status, OnboardingStatus.SKIPPED);

        const now = new Date();
        const updateRes = await tx.onboardingProgress.updateMany({
          where: {
            userId,
            revision: dto.expectedRevision
          },
          data: {
            status: OnboardingStatus.SKIPPED,
            revision: { increment: 1 },
            skippedAt: now
          }
        });

        if (updateRes.count === 0) {
          throw new ConflictException({
            message: "Optimistic concurrency conflict: onboarding data was modified in another session.",
            expectedRevision: dto.expectedRevision,
            currentRevision: existing.revision
          });
        }

        return {
          status: OnboardingStatus.SKIPPED,
          revision: dto.expectedRevision + 1,
          skippedAt: now
        };
      });
    } catch (err) {
      if (err instanceof ConflictException) {
        const errResp = err.getResponse() as any;
        if (typeof errResp === "object" && !errResp.currentState) {
          const currentState = await this.getOnboardingState(userId);
          throw new ConflictException({
            ...errResp,
            currentState
          });
        }
      }
      throw err;
    }
  }

  async complete(userId: string, dto: CompleteOnboardingDto) {
    const allSteps: OnboardingStep[] = [
      OnboardingStep.GOAL,
      OnboardingStep.REACH,
      OnboardingStep.FIT,
      OnboardingStep.REVIEW
    ];

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.expectedRevision === 0) {
          try {
            const created = await tx.onboardingProgress.create({
              data: {
                userId,
                status: OnboardingStatus.COMPLETED,
                version: 1,
                revision: 1,
                currentStep: OnboardingStep.REVIEW,
                completedSteps: allSteps,
                completedAt: new Date()
              }
            });
            return {
              status: created.status,
              revision: created.revision,
              completedAt: created.completedAt
            };
          } catch (error: any) {
            if (error?.code === "P2002" || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) {
              throw new ConflictException({
                message: "Optimistic concurrency conflict: onboarding data was modified in another session.",
                expectedRevision: 0,
                currentRevision: 1
              });
            }
            throw error;
          }
        }

        const existing = await tx.onboardingProgress.findUnique({
          where: { userId }
        });
        if (!existing) {
          throw new ConflictException({
            message: "Optimistic concurrency conflict: onboarding record does not exist for the expected revision.",
            expectedRevision: dto.expectedRevision,
            currentRevision: 0
          });
        }
        this.validateTransition(existing.status, OnboardingStatus.COMPLETED);

        const now = new Date();
        const updateRes = await tx.onboardingProgress.updateMany({
          where: {
            userId,
            revision: dto.expectedRevision
          },
          data: {
            status: OnboardingStatus.COMPLETED,
            revision: { increment: 1 },
            currentStep: OnboardingStep.REVIEW,
            completedSteps: allSteps,
            completedAt: now
          }
        });

        if (updateRes.count === 0) {
          throw new ConflictException({
            message: "Optimistic concurrency conflict: onboarding data was modified in another session.",
            expectedRevision: dto.expectedRevision,
            currentRevision: existing.revision
          });
        }

        return {
          status: OnboardingStatus.COMPLETED,
          revision: dto.expectedRevision + 1,
          completedAt: now
        };
      });
    } catch (err) {
      if (err instanceof ConflictException) {
        const errResp = err.getResponse() as any;
        if (typeof errResp === "object" && !errResp.currentState) {
          const currentState = await this.getOnboardingState(userId);
          throw new ConflictException({
            ...errResp,
            currentState
          });
        }
      }
      throw err;
    }
  }
}

