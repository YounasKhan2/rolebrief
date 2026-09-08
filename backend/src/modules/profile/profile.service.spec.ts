import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ConflictException, ForbiddenException, BadRequestException } from "@nestjs/common";
import { Role, SeniorityLevel, SkillSource } from "@prisma/client";
import { ProfileService } from "./profile.service";
import { UserRoleGuard } from "../../auth/user-role.guard";
import {
  calculateOnboardingBriefCompleteness,
  calculateProfileCompleteness
} from "./profile-completeness.util";

test("ProfileService: saveCandidateData increments revision and updates candidate profile atomically", async () => {
  let updatedRevision: number | null = null;
  let userTimezoneUpdated: string | null = null;

  const mockPrisma = {
    $transaction: async (fn: any) => {
      const tx = {
        candidateProfile: {
          findUnique: async () => ({
            id: "prof_1",
            userId: "usr_1",
            revision: 3
          }),
          upsert: async (args: any) => {
            updatedRevision = args.update.revision;
            return {
              id: "prof_1",
              userId: "usr_1",
              revision: args.update.revision
            };
          },
          findUniqueOrThrow: async () => ({
            id: "prof_1",
            userId: "usr_1",
            headline: "Staff Engineer",
            bio: "Experienced backend engineer building distributed systems.",
            experienceYears: 10,
            seniorityLevel: SeniorityLevel.SENIOR,
            currentCountry: "GB",
            currentCity: "London",
            workAuthorizations: ["GB"],
            requiresVisaSponsorship: false,
            searchStatus: null,
            revision: updatedRevision!,
            createdAt: new Date(),
            updatedAt: new Date(),
            user: {
              id: "usr_1",
              name: "Alice",
              email: "alice@example.com",
              role: Role.USER,
              status: "ACTIVE",
              timezone: "Europe/London"
            },
            preferences: null,
            skills: []
          })
        },
        candidatePreference: {
          upsert: async () => ({})
        },
        user: {
          update: async (args: any) => {
            userTimezoneUpdated = args.data.timezone;
            return {};
          }
        }
      };
      return fn(tx);
    }
  };

  const service = new ProfileService(mockPrisma as any);

  const res = await service.updateProfile("usr_1", {
    expectedRevision: 3,
    profile: {
      headline: "Staff Engineer",
      bio: "Experienced backend engineer building distributed systems.",
      experienceYears: 10,
      seniorityLevel: SeniorityLevel.SENIOR,
      currentCountry: "gb",
      currentCity: "London",
      timezone: "Europe/London",
      workAuthorizations: ["gb"],
      requiresVisaSponsorship: false
    }
  });

  assert.equal(updatedRevision, 4, "Revision must increment from 3 to 4");
  assert.equal(res.profileRevision, 4);
  assert.equal(res.profile.revision, 4);
  assert.equal(res.profile.timezone, "Europe/London");
  assert.equal(userTimezoneUpdated, "Europe/London", "User.timezone must be synced");
});

test("ProfileService: saveCandidateData rejects stale expectedRevision with 409 ConflictException", async () => {
  const mockPrisma = {
    user: {
      findUnique: async () => ({
        id: "usr_1",
        name: "Alice",
        email: "alice@example.com",
        role: Role.USER,
        status: "ACTIVE",
        timezone: "UTC"
      })
    },
    candidateProfile: {
      findUnique: async () => ({
        id: "prof_1",
        userId: "usr_1",
        revision: 5,
        preferences: null,
        skills: []
      })
    },
    $transaction: async (fn: any) => {
      const tx = {
        candidateProfile: {
          findUnique: async () => ({
            id: "prof_1",
            userId: "usr_1",
            revision: 5
          })
        }
      };
      return fn(tx);
    }
  };

  const service = new ProfileService(mockPrisma as any);

  await assert.rejects(
    async () => {
      await service.updateProfile("usr_1", {
        expectedRevision: 4, // Stale! Server is at 5
        profile: { headline: "Senior Engineer" }
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof ConflictException);
      const resp = (err as ConflictException).getResponse() as any;
      assert.equal(resp.expectedRevision, 4);
      assert.equal(resp.currentRevision, 5);
      assert.ok(resp.currentState, "Must include safe latest currentState");
      return true;
    }
  );
});

test("ProfileService: saveCandidateData deletes only USER_DECLARED skills preserving parser skills", async () => {
  let deletedFilter: any = null;
  const upsertedSkills: any[] = [];

  const mockPrisma = {
    $transaction: async (fn: any) => {
      const tx = {
        candidateProfile: {
          findUnique: async () => ({
            id: "prof_1",
            userId: "usr_1",
            revision: 1
          }),
          upsert: async () => ({ id: "prof_1", revision: 2 }),
          findUniqueOrThrow: async () => ({
            id: "prof_1",
            userId: "usr_1",
            revision: 2,
            user: { id: "usr_1", name: "Bob", email: "bob@example.com", role: Role.USER, status: "ACTIVE", timezone: "UTC" },
            preferences: null,
            skills: []
          })
        },
        candidateSkill: {
          deleteMany: async (args: any) => {
            deletedFilter = args.where;
          },
          upsert: async (args: any) => {
            upsertSkillsSkills: upsertedSkills.push(args);
          }
        }
      };
      return fn(tx);
    }
  };

  const service = new ProfileService(mockPrisma as any);

  await service.saveCandidateData("usr_1", {
    expectedRevision: 1,
    skills: [
      { displayName: "  TypeScript  " },
      { displayName: "PostgreSQL" }
    ]
  });

  assert.ok(deletedFilter);
  assert.equal(deletedFilter.source, SkillSource.USER_DECLARED, "Must restrict deletion to USER_DECLARED skills");
  assert.deepEqual(deletedFilter.normalizedName.notIn, ["typescript", "postgresql"]);
  assert.equal(upsertedSkills.length, 2);
  assert.equal(upsertedSkills[0].create.source, SkillSource.USER_DECLARED);
  assert.equal(upsertedSkills[0].create.displayName, "TypeScript", "Must trim whitespace");
  assert.equal(upsertedSkills[0].create.normalizedName, "typescript");
});

test("ProfileService: skill normalization collapses internal whitespace and handles Unicode NFKC", async () => {
  const upsertedSkills: any[] = [];

  const mockPrisma = {
    $transaction: async (fn: any) => {
      const tx = {
        candidateProfile: {
          findUnique: async () => ({ id: "prof_1", revision: 0 }),
          upsert: async () => ({ id: "prof_1", revision: 1 }),
          findUniqueOrThrow: async () => ({
            id: "prof_1",
            userId: "usr_1",
            revision: 1,
            user: { id: "usr_1", name: "Charlie", email: "c@example.com", role: Role.USER, status: "ACTIVE", timezone: "UTC" },
            preferences: null,
            skills: []
          })
        },
        candidateSkill: {
          deleteMany: async () => {},
          upsert: async (args: any) => {
            upsertedSkills.push(args);
          }
        }
      };
      return fn(tx);
    }
  };

  const service = new ProfileService(mockPrisma as any);

  await service.saveCandidateData("usr_1", {
    expectedRevision: 0,
    skills: [
      { displayName: "  Node.js   Backend  " },
      { displayName: "node.js backend" } // duplicate after normalization
    ]
  });

  assert.equal(upsertedSkills.length, 1, "Duplicate normalized skills must be collapsed");
  assert.equal(upsertedSkills[0].create.displayName, "Node.js Backend", "Internal whitespace must be collapsed to single space");
  assert.equal(upsertedSkills[0].create.normalizedName, "node.js backend");
});

test("UserRoleGuard: allows USER role and rejects ADMIN role with clear explanation", () => {
  const guard = new UserRoleGuard();

  const userContext = {
    switchToHttp: () => ({
      getRequest: () => ({
        user: { role: Role.USER }
      })
    })
  };

  assert.equal(guard.canActivate(userContext as any), true);

  const adminContext = {
    switchToHttp: () => ({
      getRequest: () => ({
        user: { role: Role.ADMIN }
      })
    })
  };

  assert.throws(
    () => guard.canActivate(adminContext as any),
    (err: any) => {
      assert.ok(err instanceof ForbiddenException);
      assert.match(err.message, /Admins cannot manage candidate profiles/);
      return true;
    }
  );
});

test("Completeness: Table-driven validation across all profile dimensions", () => {
  // 1. Empty profile
  const emptyScore = calculateProfileCompleteness(null);
  assert.equal(emptyScore.score, 0);

  // 2. Fully populated profile with Bio earns 100%
  const completeProfile = {
    id: "p_full",
    userId: "u_full",
    headline: "Staff Systems Engineer",
    bio: "Passionate infrastructure engineer with over a decade of experience designing fault-tolerant platforms.",
    experienceYears: 12,
    seniorityLevel: SeniorityLevel.PRINCIPAL,
    currentCountry: "US",
    currentCity: "Austin",
    workAuthorizations: ["US"],
    requiresVisaSponsorship: false,
    searchStatus: null,
    revision: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    preferences: {
      id: "pref_full",
      profileId: "p_full",
      targetRoleTitles: ["Staff Software Engineer", "Principal Architect"],
      targetDisciplines: ["Platform Infrastructure", "Backend Engineering"],
      remotePreference: null,
      preferredCountries: ["US"],
      preferredCities: [],
      employmentTypes: [],
      relocationPreference: null,
      minSalary: null,
      maxSalary: null,
      salaryCurrency: null,
      salaryPeriod: null,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    skills: [
      { id: "s1", profileId: "p_full", displayName: "Rust", normalizedName: "rust", yearsExperience: 6, isTopSkill: true, source: SkillSource.USER_DECLARED, createdAt: new Date(), updatedAt: new Date() },
      { id: "s2", profileId: "p_full", displayName: "Go", normalizedName: "go", yearsExperience: 8, isTopSkill: true, source: SkillSource.USER_DECLARED, createdAt: new Date(), updatedAt: new Date() },
      { id: "s3", profileId: "p_full", displayName: "PostgreSQL", normalizedName: "postgresql", yearsExperience: 10, isTopSkill: false, source: SkillSource.USER_DECLARED, createdAt: new Date(), updatedAt: new Date() }
    ]
  };

  const fullScore = calculateProfileCompleteness(completeProfile as any);
  assert.equal(fullScore.score, 90); // 25 (roles) + 10 (location) + 25 (skills) + 15 (seniority & exp) + 15 (headline & bio) = 90 (remote not specified)

  // With remote preference:
  (completeProfile.preferences as any).remotePreference = "REMOTE_ONLY";
  const perfectScore = calculateProfileCompleteness(completeProfile as any);
  assert.equal(perfectScore.score, 100, "Must be able to reach 100% total profile completeness");

  // 3. Opportunity brief completeness: Undeclared sponsorship earns 0%, declared earns 5%
  const undeclaredSponsorshipProfile = {
    ...completeProfile,
    workAuthorizations: [],
    requiresVisaSponsorship: null // Not declared!
  };
  const briefUndeclared = calculateOnboardingBriefCompleteness(undeclaredSponsorshipProfile as any);
  assert.equal(briefUndeclared.location, 20); // 10 (country) + 10 (remote) = 20

  const declaredNoSponsorshipProfile = {
    ...completeProfile,
    workAuthorizations: [],
    requiresVisaSponsorship: false // Explicitly declared No
  };
  const briefDeclared = calculateOnboardingBriefCompleteness(declaredNoSponsorshipProfile as any);
  assert.equal(briefDeclared.location, 25); // 10 (country) + 10 (remote) + 5 (explicit declared) = 25
});
