import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { NotFoundException } from "@nestjs/common";
import { EligibilityEvaluatorService } from "./eligibility-evaluator.service";
import { EligibilityService } from "./eligibility.service";
import { TimezoneResolverService } from "./timezone-resolver.service";

describe("EligibilityService", () => {
  let service: EligibilityService;
  let mockPrisma: any;
  let mockConfig: any;
  let evaluator: EligibilityEvaluatorService;

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  beforeEach(() => {
    evaluator = new EligibilityEvaluatorService(new TimezoneResolverService());
    mockConfig = { redisUrl: "redis://127.0.0.1:6379" };

    mockPrisma = {
      candidateProfile: {
        findUnique: async () => ({
          currentCountry: "US",
          workAuthorizations: ["US"],
          requiresVisaSponsorship: false,
          revision: 2
        })
      },
      user: {
        findUnique: async () => ({
          timezone: "America/New_York"
        })
      },
      job: {
        findMany: async () => [
          {
            id: "job-1-id",
            slug: "job-1",
            canonicalTitle: "Engineer 1",
            status: "ACTIVE",
            workMode: "REMOTE",
            remoteScope: "COUNTRY_AND_TIMEZONE_LIMITED",
            remoteCountryCodes: ["US"],
            remoteRestrictionLabels: ["United States"],
            remoteRestrictions: { timezoneOffsetMinutes: [-300] },
            sourceDisclosure: { applicationUrl: "https://example.com/apply" },
            canonicalFingerprint: "fp1"
          },
          {
            id: "job-2-id",
            slug: "job-2",
            canonicalTitle: "Engineer 2",
            status: "ACTIVE",
            workMode: "REMOTE",
            remoteScope: "COUNTRY_LIMITED",
            remoteCountryCodes: ["CA"],
            remoteRestrictionLabels: ["Canada"],
            remoteRestrictions: {},
            sourceDisclosure: { applicationUrl: "https://example.com/apply" },
            canonicalFingerprint: "fp2"
          }
        ],
        findUnique: async ({ where }: any) => {
          if (where.slug === "non-existent") return null;
          return {
            id: "job-1-id",
            slug: where.slug,
            canonicalTitle: "Engineer 1",
            status: "ACTIVE",
            workMode: "REMOTE",
            remoteScope: "COUNTRY_AND_TIMEZONE_LIMITED",
            remoteCountryCodes: ["US"],
            remoteRestrictionLabels: ["United States"],
            remoteRestrictions: { timezoneOffsetMinutes: [-300] },
            sourceDisclosure: { applicationUrl: "https://example.com/apply" },
            canonicalFingerprint: "fp1"
          };
        }
      }
    };

    service = new EligibilityService(mockPrisma, mockConfig, evaluator);
  });

  it("getCandidateFacts retrieves facts from CandidateProfile and User.timezone", async () => {
    const facts = await service.getCandidateFacts("user_1");
    assert.equal(facts.userId, "user_1");
    assert.equal(facts.currentCountry, "US");
    assert.deepEqual(facts.workAuthorizations, ["US"]);
    assert.equal(facts.requiresVisaSponsorship, false);
    assert.equal(facts.timezone, "America/New_York");
    assert.equal(facts.revision, 2);
  });

  it("evaluateBatch evaluates multiple jobs and preserves input slug order", async () => {
    const results = await service.evaluateBatch("user_1", ["job-2", "job-1"]);
    assert.equal(results.length, 2);
    assert.equal(results[0].slug, "job-2");
    assert.equal(results[0].overallStatus, "CONFLICT"); // Candidate US vs Job CA
    assert.equal(results[1].slug, "job-1");
    assert.equal(results[1].overallStatus, "APPEARS_ELIGIBLE"); // Candidate US vs Job US
  });

  it("evaluateBatch returns empty array for empty input", async () => {
    const results = await service.evaluateBatch("user_1", []);
    assert.deepEqual(results, []);
  });

  it("evaluateJob throws NotFoundException for nonexistent slug", async () => {
    await assert.rejects(
      async () => service.evaluateJob("user_1", "non-existent"),
      (err: any) => err instanceof NotFoundException
    );
  });

  it("evaluateJob returns detailed evaluation with 3 factual dimensions and jobAvailability", async () => {
    const result = await service.evaluateJob("user_1", "job-1");
    assert.equal(result.slug, "job-1");
    assert.equal(result.overallStatus, "APPEARS_ELIGIBLE");
    assert.equal(result.dimensions.length, 3);
    assert.equal(result.jobAvailability.status, "ACTIVE");
    assert.equal(result.jobAvailability.canApply, true);
    assert.equal(result.knownFacts.candidateResidenceCountry, "US");
    assert.equal(typeof result.disclaimer, "string");
  });
});
