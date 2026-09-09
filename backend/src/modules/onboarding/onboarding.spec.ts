import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestException, ConflictException } from "@nestjs/common";
import {
  CandidateSearchStatus,
  EmploymentType,
  OnboardingStatus,
  OnboardingStep,
  Prisma,
  RelocationPreference,
  RemotePreference,
  SalaryPeriod,
  SeniorityLevel,
  SkillSource
} from "@prisma/client";
import {
  calculateOnboardingBriefCompleteness,
  calculateProfileCompleteness
} from "../profile/profile-completeness.util";
import { OnboardingService } from "./onboarding.service";
import { ProfileService } from "../profile/profile.service";
import { OnboardingStepEnum } from "../profile/dto/profile.dto";

test("calculateProfileCompleteness and calculateOnboardingBriefCompleteness calculate distinct scores", () => {
  // Empty profile: 0%
  assert.equal(calculateProfileCompleteness(null).score, 0);
  assert.equal(calculateOnboardingBriefCompleteness(null).score, 0);

  // Profile with wizard fields completed but NO headline/bio
  const wizardOnlyProfile = {
    id: "prof_1",
    userId: "usr_1",
    headline: null,
    bio: null,
    experienceYears: 8,
    seniorityLevel: SeniorityLevel.SENIOR,
    primaryDiscipline: "Platform Engineering",
    currentCountry: "US",
    currentCity: "San Francisco",
    timezone: "America/Los_Angeles",
    workAuthorizations: ["US"],
    requiresVisaSponsorship: false,
    searchStatus: CandidateSearchStatus.ACTIVELY_LOOKING,
    revision: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    preferences: {
      id: "pref_1",
      profileId: "prof_1",
      targetRoleTitles: ["Staff Infrastructure Engineer"],
      targetDisciplines: ["Platform Infrastructure"],
      remotePreference: RemotePreference.REMOTE_ONLY,
      preferredCountries: ["US"],
      preferredCities: ["San Francisco"],
      employmentTypes: [EmploymentType.FULL_TIME],
      relocationPreference: RelocationPreference.NOT_OPEN,
      minSalary: 180000,
      maxSalary: 240000,
      salaryCurrency: "USD",
      salaryPeriod: SalaryPeriod.ANNUAL,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    skills: [
      {
        id: "sk_1",
        profileId: "prof_1",
        displayName: "Kubernetes",
        normalizedName: "kubernetes",
        yearsExperience: 5,
        isTopSkill: true,
        source: SkillSource.USER_DECLARED,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "sk_2",
        profileId: "prof_1",
        displayName: "Go",
        normalizedName: "go",
        yearsExperience: 6,
        isTopSkill: true,
        source: SkillSource.USER_DECLARED,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "sk_3",
        profileId: "prof_1",
        displayName: "PostgreSQL",
        normalizedName: "postgresql",
        yearsExperience: 8,
        isTopSkill: false,
        source: SkillSource.USER_DECLARED,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]
  };

  // Opportunity Brief completeness is 100% because all wizard-required pillars are met
  const briefScore = calculateOnboardingBriefCompleteness(wizardOnlyProfile);
  assert.equal(briefScore.score, 100);
  assert.equal(briefScore.roles, 25);
  assert.equal(briefScore.location, 25);
  assert.equal(briefScore.skills, 25);
  assert.equal(briefScore.compensationAndPreferences, 25);

  // Full Profile completeness is 85% because headline & bio (15 pts) are missing
  const fullScore = calculateProfileCompleteness(wizardOnlyProfile);
  assert.equal(fullScore.score, 85);
  assert.equal(fullScore.headlineAndBio, 0);
});

test("OnboardingService: getOnboardingState is strictly read-only and returns default for new users", async () => {
  let findUniqueUserCalled = false;
  let findUniqueProgressCalled = false;
  let findUniqueCandidateCalled = false;

  const mockPrisma = {
    user: {
      findUnique: async () => {
        findUniqueUserCalled = true;
        return { id: "user_test_1", name: "Candidate", email: "candidate@test.com", role: "USER", status: "ACTIVE" };
      }
    },
    onboardingProgress: {
      findUnique: async () => {
        findUniqueProgressCalled = true;
        return null;
      }
    },
    candidateProfile: {
      findUnique: async () => {
        findUniqueCandidateCalled = true;
        return null;
      }
    }
  };

  const profileService = new ProfileService(mockPrisma as any);
  const onboardingService = new OnboardingService(mockPrisma as any, profileService);

  const state = await onboardingService.getOnboardingState("user_test_1");

  assert.ok(findUniqueUserCalled);
  assert.ok(findUniqueProgressCalled);
  assert.ok(findUniqueCandidateCalled);

  // Virtual default
  assert.equal(state.progress.status, OnboardingStatus.NOT_STARTED);
  assert.equal(state.progress.revision, 0);
  assert.equal(state.progress.currentStep, OnboardingStep.GOAL);
  assert.deepEqual(state.progress.completedSteps, []);
  assert.equal(state.progress.startedAt, null);
  assert.equal(state.profile, null);
  assert.equal(state.preferences, null);
  assert.deepEqual(state.skills, []);
  assert.equal(state.completeness, 0);
  assert.equal(state.briefCompleteness, 0);
});

test("OnboardingService: autosave handles first save (revision 0) and creates record", async () => {
  let createdData: any = null;

  const mockPrisma = {
    $transaction: async (fn: any) => {
      const tx = {
        onboardingProgress: {
          create: async (args: any) => {
            createdData = args.data;
            return {
              id: "prog_1",
              ...args.data,
              createdAt: new Date(),
              updatedAt: new Date()
            };
          },
          findUniqueOrThrow: async () => ({
            id: "prog_1",
            userId: "user_test_1",
            status: OnboardingStatus.IN_PROGRESS,
            version: 1,
            currentStep: OnboardingStep.GOAL,
            completedSteps: [],
            revision: 1,
            startedAt: new Date(),
            completedAt: null,
            skippedAt: null,
            updatedAt: new Date()
          })
        },
        candidateProfile: {
          findUnique: async () => null
        }
      };
      return fn(tx);
    }
  };

  const profileService = new ProfileService(mockPrisma as any);
  const onboardingService = new OnboardingService(mockPrisma as any, profileService);

  const res = await onboardingService.autosave("user_test_1", {
    expectedRevision: 0,
    currentStep: OnboardingStepEnum.GOAL
  });

  assert.ok(createdData);
  assert.equal(createdData.revision, 1);
  assert.equal(createdData.status, OnboardingStatus.IN_PROGRESS);
  assert.equal(createdData.currentStep, OnboardingStep.GOAL);
  assert.equal(res.progress.revision, 1);
});

test("OnboardingService: autosave catches P2002 race condition on simultaneous first save", async () => {
  const p2002Error = new Prisma.PrismaClientKnownRequestError(
    "Unique constraint failed on the fields: (`userId`)",
    {
      code: "P2002",
      clientVersion: "6.0.0"
    }
  );

  const mockPrisma = {
    $transaction: async (fn: any) => {
      const tx = {
        onboardingProgress: {
          create: async () => {
            throw p2002Error;
          },
          findUnique: async () => ({
            id: "prog_1",
            userId: "user_test_1",
            revision: 1
          })
        }
      };
      return fn(tx);
    }
  };

  const profileService = new ProfileService(mockPrisma as any);
  const onboardingService = new OnboardingService(mockPrisma as any, profileService);

  await assert.rejects(
    async () => {
      await onboardingService.autosave("user_test_1", {
        expectedRevision: 0,
        currentStep: OnboardingStepEnum.GOAL
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof ConflictException);
      const res = (err as ConflictException).getResponse() as any;
      assert.equal(res.expectedRevision, 0);
      return true;
    }
  );
});

test("OnboardingService: autosave optimistic concurrency rejects stale revision with atomic updateMany", async () => {
  const mockPrisma = {
    $transaction: async (fn: any) => {
      const tx = {
        onboardingProgress: {
          updateMany: async () => ({ count: 0 }),
          findUnique: async () => ({
            id: "prog_1",
            userId: "user_test_1",
            status: OnboardingStatus.IN_PROGRESS,
            revision: 2,
            currentStep: OnboardingStep.REACH,
            completedSteps: [OnboardingStep.GOAL]
          })
        }
      };
      return fn(tx);
    }
  };

  const profileService = new ProfileService(mockPrisma as any);
  const onboardingService = new OnboardingService(mockPrisma as any, profileService);

  await assert.rejects(
    async () => {
      await onboardingService.autosave("user_test_1", {
        expectedRevision: 1,
        currentStep: OnboardingStepEnum.FIT
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof ConflictException);
      const res = (err as ConflictException).getResponse() as any;
      assert.equal(res.currentRevision, 2);
      assert.equal(res.expectedRevision, 1);
      return true;
    }
  );
});

test("ProfileService: saveCandidateData leaves CandidateSkill untouched if skills is undefined", async () => {
  let deleteManySkillsCalled = false;
  let upsertSkillsCalled = false;

  const mockTx = {
    candidateProfile: {
      findUnique: async () => null,
      upsert: async () => ({ id: "prof_1", userId: "usr_1", revision: 1 }),
      findUniqueOrThrow: async () => ({
        id: "prof_1",
        userId: "usr_1",
        revision: 1,
        user: { id: "usr_1", name: "Test", email: "test@example.com", role: "USER", status: "ACTIVE", timezone: "UTC" },
        preferences: null,
        skills: [{ id: "sk_1", displayName: "TypeScript", normalizedName: "typescript" }]
      })
    },
    candidatePreference: {
      upsert: async () => ({})
    },
    candidateSkill: {
      deleteMany: async () => {
        deleteManySkillsCalled = true;
      },
      upsert: async () => {
        upsertSkillsCalled = true;
      }
    }
  };

  const profileService = new ProfileService({} as any);

  // Partial save from Step 0 or Step 1: skills is undefined
  await profileService.saveCandidateData(
    "usr_1",
    {
      expectedRevision: 0,
      preferences: {
        targetRoleTitles: ["Full Stack Engineer"]
      }
    },
    mockTx as any
  );

  assert.equal(deleteManySkillsCalled, false, "Must NOT delete skills when skills is undefined");
  assert.equal(upsertSkillsCalled, false, "Must NOT modify skills when skills is undefined");
});

test("Opportunity brief completeness is 100% when salary is undisclosed", () => {
  const undisclosedSalaryProfile = {
    id: "prof_undisclosed",
    userId: "usr_undisclosed",
    headline: null,
    bio: null,
    experienceYears: 6,
    seniorityLevel: SeniorityLevel.SENIOR,
    primaryDiscipline: "Full Stack Engineering",
    currentCountry: "GB",
    currentCity: "London",
    timezone: "Europe/London",
    workAuthorizations: ["GB"],
    requiresVisaSponsorship: false,
    searchStatus: CandidateSearchStatus.ACTIVELY_LOOKING,
    revision: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    preferences: {
      id: "pref_undisclosed",
      profileId: "prof_undisclosed",
      targetRoleTitles: ["Full Stack Tech Lead"],
      targetDisciplines: ["Engineering"],
      remotePreference: RemotePreference.HYBRID,
      preferredCountries: ["GB"],
      preferredCities: ["London"],
      employmentTypes: [EmploymentType.FULL_TIME],
      relocationPreference: RelocationPreference.NOT_OPEN,
      minSalary: null,
      maxSalary: null,
      salaryCurrency: null,
      salaryPeriod: null,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    skills: [
      { id: "s1", profileId: "prof_undisclosed", displayName: "TypeScript", normalizedName: "typescript", yearsExperience: 6, isTopSkill: true, source: SkillSource.USER_DECLARED, createdAt: new Date(), updatedAt: new Date() },
      { id: "s2", profileId: "prof_undisclosed", displayName: "React", normalizedName: "react", yearsExperience: 6, isTopSkill: true, source: SkillSource.USER_DECLARED, createdAt: new Date(), updatedAt: new Date() },
      { id: "s3", profileId: "prof_undisclosed", displayName: "Node.js", normalizedName: "nodejs", yearsExperience: 6, isTopSkill: false, source: SkillSource.USER_DECLARED, createdAt: new Date(), updatedAt: new Date() }
    ]
  };

  const brief = calculateOnboardingBriefCompleteness(undisclosedSalaryProfile);
  assert.equal(brief.score, 100, "Brief must reach 100% without disclosing salary");
  assert.equal(brief.compensationAndPreferences, 25, "Work terms & preferences must reach 25% without salary");
});

test("OnboardingService: skip and complete transition statuses and increment revision", async () => {
  const mockPrisma = {
    $transaction: async (fn: any) => fn(mockTx),
    onboardingProgress: {
      findUnique: async () => ({ status: OnboardingStatus.NOT_STARTED, revision: 3 })
    }
  };

  const mockTx: any = {
    onboardingProgress: {
      findUnique: async () => ({ status: OnboardingStatus.NOT_STARTED, revision: 3 }),
      updateMany: async () => ({ count: 1 })
    }
  };

  const profileService = new ProfileService(mockPrisma as any);
  const onboardingService = new OnboardingService(mockPrisma as any, profileService);

  // Test skip (from NOT_STARTED)
  const skipped = await onboardingService.skip("user_test_1", { expectedRevision: 3 });
  assert.equal(skipped.status, OnboardingStatus.SKIPPED);
  assert.equal(skipped.revision, 4);
  assert.ok(skipped.skippedAt);

  // Test complete (from IN_PROGRESS)
  mockTx.onboardingProgress.findUnique = async () => ({ status: OnboardingStatus.IN_PROGRESS, revision: 3 });
  const completed = await onboardingService.complete("user_test_1", { expectedRevision: 3 });
  assert.equal(completed.status, OnboardingStatus.COMPLETED);
  assert.equal(completed.revision, 4);
  assert.ok(completed.completedAt);
});

test("OnboardingService: state machine enforces transition policy", async () => {
  // 1. SKIPPED -> COMPLETED is intentionally allowed
  const mockTxAllowed = {
    onboardingProgress: {
      findUnique: async () => ({ status: OnboardingStatus.SKIPPED, revision: 1 }),
      updateMany: async () => ({ count: 1 })
    }
  };
  const mockPrismaAllowed = {
    $transaction: async (fn: any) => fn(mockTxAllowed),
    onboardingProgress: {
      findUnique: async () => ({ status: OnboardingStatus.SKIPPED, revision: 1 })
    }
  };
  const serviceAllowed = new OnboardingService(mockPrismaAllowed as any, {} as any);
  const completed = await serviceAllowed.complete("user_test_1", { expectedRevision: 1 });
  assert.equal(completed.status, OnboardingStatus.COMPLETED);

  // 2. COMPLETED -> SKIPPED is strictly rejected with BadRequestException
  const mockTxForbidden = {
    onboardingProgress: {
      findUnique: async () => ({ status: OnboardingStatus.COMPLETED, revision: 2 })
    }
  };
  const mockPrismaForbidden = {
    $transaction: async (fn: any) => fn(mockTxForbidden),
    onboardingProgress: {
      findUnique: async () => ({ status: OnboardingStatus.COMPLETED, revision: 2 })
    }
  };
  const serviceForbidden = new OnboardingService(mockPrismaForbidden as any, {} as any);
  await assert.rejects(
    () => serviceForbidden.skip("user_test_1", { expectedRevision: 2 }),
    (err: any) => {
      assert.ok(err instanceof BadRequestException);
      assert.match(err.message, /Invalid onboarding status transition/);
      return true;
    }
  );
});

test("OnboardingService: stale skip/complete requests with expectedRevision mismatch return 409 with safe currentState", async () => {
  const mockTx = {
    onboardingProgress: {
      findUnique: async () => ({ id: "prog_1", userId: "user_test_1", status: OnboardingStatus.IN_PROGRESS, revision: 5 }),
      updateMany: async () => ({ count: 0 })
    }
  };
  const mockPrisma = {
    $transaction: async (fn: any) => fn(mockTx),
    user: {
      findUnique: async () => ({ id: "user_test_1", name: "Alice", email: "alice@example.com", role: "USER", status: "ACTIVE" })
    },
    onboardingProgress: {
      findUnique: async () => ({ id: "prog_1", userId: "user_test_1", status: OnboardingStatus.IN_PROGRESS, revision: 5 })
    },
    candidateProfile: {
      findUnique: async () => null
    }
  };

  const profileService = new ProfileService(mockPrisma as any);
  const onboardingService = new OnboardingService(mockPrisma as any, profileService);

  // Stale expectedRevision: passed 3, server is at 5
  await assert.rejects(
    () => onboardingService.complete("user_test_1", { expectedRevision: 3 }),
    (err: any) => {
      assert.ok(err instanceof ConflictException);
      const resp = err.getResponse() as any;
      assert.equal(resp.expectedRevision, 3);
      assert.equal(resp.currentRevision, 5);
      assert.ok(resp.currentState);
      assert.equal(resp.currentState.user.id, "user_test_1");
      return true;
    }
  );
});

