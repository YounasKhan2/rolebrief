import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ConflictException } from "@nestjs/common";
import { OnboardingStatus, RemotePreference, SeniorityLevel } from "@prisma/client";
import { calculateProfileCompleteness } from "../profile/profile-completeness.util";
import { OnboardingService } from "./onboarding.service";
import { ProfileService } from "../profile/profile.service";

test("calculateProfileCompleteness produces exact deterministic scores", () => {
  // Empty profile: 0%
  assert.equal(calculateProfileCompleteness(null).score, 0);

  // Partial profile
  const partial = calculateProfileCompleteness({
    id: "prof_1",
    userId: "usr_1",
    headline: "Staff Systems Engineer",
    bio: null,
    experienceYears: 8,
    seniorityLevel: SeniorityLevel.SENIOR,
    primaryDiscipline: "Distributed Systems",
    currentCountry: "US",
    currentCity: "San Francisco",
    workAuthorizations: ["US"],
    createdAt: new Date(),
    updatedAt: new Date(),
    preferences: {
      id: "pref_1",
      profileId: "prof_1",
      targetRoleTitles: ["Staff Systems Engineer"],
      targetDisciplines: ["Platform Infrastructure"],
      remotePreference: RemotePreference.REMOTE_ONLY,
      preferredCountries: ["US"],
      preferredCities: [],
      minSalary: 180000,
      maxSalary: 240000,
      salaryCurrency: "USD",
      createdAt: new Date(),
      updatedAt: new Date()
    },
    skills: [
      {
        id: "sk_1",
        profileId: "prof_1",
        displayName: "Rust",
        normalizedName: "rust",
        yearsExperience: 5,
        isTopSkill: true,
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
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]
  });

  // All 5 pillars complete:
  // roles & disciplines: 25
  // location & remote: 20
  // skills (>= 3): 25
  // seniority & exp: 15
  // headline & discipline: 15
  assert.equal(partial.score, 100);
  assert.equal(partial.rolesAndDisciplines, 25);
  assert.equal(partial.locationAndRemote, 20);
  assert.equal(partial.skills, 25);
  assert.equal(partial.seniorityAndExperience, 15);
  assert.equal(partial.headlineAndBio, 15);
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
        return null; // no record exists yet
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
  assert.equal(state.progress.currentStep, "role");
  assert.deepEqual(state.progress.completedSteps, []);
  assert.equal(state.progress.startedAt, null);
  assert.equal(state.profile, null);
  assert.equal(state.preferences, null);
  assert.deepEqual(state.skills, []);
  assert.equal(state.completeness, 0);
});

test("OnboardingService: autosave optimistic concurrency rejects stale revision", async () => {
  const mockPrisma = {
    $transaction: async (fn: any) => {
      const tx = {
        onboardingProgress: {
          findUnique: async () => ({
            id: "prog_1",
            userId: "user_test_1",
            status: OnboardingStatus.IN_PROGRESS,
            revision: 2,
            currentStep: "location",
            completedSteps: ["role"]
          })
        }
      };
      return fn(tx);
    }
  };

  const profileService = new ProfileService(mockPrisma as any);
  const onboardingService = new OnboardingService(mockPrisma as any, profileService);

  // Client thinks revision is 1, but DB is at 2 -> must throw ConflictException
  await assert.rejects(
    async () => {
      await onboardingService.autosave("user_test_1", {
        expectedRevision: 1,
        currentStep: "skills"
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

test("OnboardingService: skip and complete transition statuses and increment revision", async () => {
  let upsertData: any = null;
  const mockPrisma = {
    onboardingProgress: {
      findUnique: async () => ({
        id: "prog_1",
        userId: "user_test_1",
        status: OnboardingStatus.IN_PROGRESS,
        revision: 3
      }),
      upsert: async (args: any) => {
        upsertData = args;
        return {
          id: "prog_1",
          userId: "user_test_1",
          status: args.update.status,
          revision: args.update.revision,
          skippedAt: args.update.skippedAt,
          completedAt: args.update.completedAt
        };
      }
    }
  };

  const profileService = new ProfileService(mockPrisma as any);
  const onboardingService = new OnboardingService(mockPrisma as any, profileService);

  // Test skip
  const skipped = await onboardingService.skip("user_test_1");
  assert.equal(skipped.status, OnboardingStatus.SKIPPED);
  assert.equal(skipped.revision, 4);
  assert.ok(skipped.skippedAt);

  // Test complete
  const completed = await onboardingService.complete("user_test_1");
  assert.equal(completed.status, OnboardingStatus.COMPLETED);
  assert.equal(completed.revision, 4);
  assert.ok(completed.completedAt);
});
