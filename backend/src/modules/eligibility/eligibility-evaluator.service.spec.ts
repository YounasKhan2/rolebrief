import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { EligibilityEvaluatorService } from "./eligibility-evaluator.service";
import { CandidateEligibilityFacts, JobEligibilityFacts } from "./factual-facts.interface";
import { ReasonCode } from "./reason-codes";
import { TimezoneResolverService } from "./timezone-resolver.service";

function createCandidate(overrides: Partial<CandidateEligibilityFacts> = {}): CandidateEligibilityFacts {
  return {
    userId: "user_test_1",
    currentCountry: "US",
    workAuthorizations: ["US"],
    requiresVisaSponsorship: false,
    timezone: "America/New_York",
    revision: 1,
    ...overrides
  };
}

function createJob(overrides: Partial<JobEligibilityFacts> = {}): JobEligibilityFacts {
  return {
    id: "job_test_12345",
    slug: "acme-corp-test-12345",
    title: "Senior Software Engineer",
    companyName: "Acme Corp",
    workMode: "REMOTE",
    remoteScope: "COUNTRY_AND_TIMEZONE_LIMITED",
    remoteCountryCodes: ["US"],
    remoteRestrictionLabels: ["United States"],
    unresolvedLabels: [],
    timezoneOffsetMinutes: [-300, -240],
    jobStatus: "ACTIVE",
    applicationDeadlineAt: null,
    applicationUrl: "https://example.com/apply",
    canonicalFingerprint: "fingerprint_12345",
    ...overrides
  };
}

describe("EligibilityEvaluatorService", () => {
  let service: EligibilityEvaluatorService;

  beforeEach(() => {
    service = new EligibilityEvaluatorService(new TimezoneResolverService());
  });

  it("returns NOT_CALCULATED when candidate profile is incomplete (missing residence country)", () => {
    const candidate = createCandidate({ currentCountry: null });
    const job = createJob();

    const res = service.evaluate(candidate, job);
    assert.equal(res.overallStatus, "NOT_CALCULATED");
    assert.equal(res.primaryReasonCode, ReasonCode.PROFILE_INCOMPLETE);
    assert.equal(res.badgeText, "Profile incomplete");
    assert.equal(res.dimensions.length, 3);
  });

  describe("Canonical Remote Scope Taxonomy Exhaustive Evaluation", () => {
    it("WORLDWIDE: evaluates SATISFIED without country restrictions", () => {
      const candidate = createCandidate({ currentCountry: "PK", workAuthorizations: ["PK"] });
      const job = createJob({
        remoteScope: "WORLDWIDE",
        remoteCountryCodes: [],
        remoteRestrictionLabels: [],
        timezoneOffsetMinutes: []
      });

      const res = service.evaluate(candidate, job);
      assert.equal(res.overallStatus, "APPEARS_ELIGIBLE");
      assert.equal(res.primaryReasonCode, ReasonCode.LOC_WORLDWIDE_NO_RESTRICTIONS);
    });

    it("TIMEZONE_LIMITED: evaluates location SATISFIED when no country restrictions, evaluates timezone", () => {
      const candidate = createCandidate({ timezone: "America/New_York" });
      const job = createJob({
        remoteScope: "TIMEZONE_LIMITED",
        remoteCountryCodes: [],
        timezoneOffsetMinutes: [-300, -240]
      });

      const res = service.evaluate(candidate, job);
      assert.equal(res.overallStatus, "APPEARS_ELIGIBLE");
      const locDim = res.dimensions.find((d) => d.dimension === "LOCATION")!;
      assert.equal(locDim.status, "SATISFIED");
    });

    it("COUNTRY_LIMITED: evaluates candidate residence or work authorization", () => {
      const candidate = createCandidate({ currentCountry: "CA", workAuthorizations: ["CA", "US"] });
      const job = createJob({
        remoteScope: "COUNTRY_LIMITED",
        remoteCountryCodes: ["US"],
        timezoneOffsetMinutes: []
      });

      const res = service.evaluate(candidate, job);
      assert.equal(res.overallStatus, "APPEARS_ELIGIBLE");
      assert.equal(res.primaryReasonCode, ReasonCode.LOC_COUNTRY_AUTHORIZED);
    });

    it("COUNTRY_AND_TIMEZONE_LIMITED: evaluates both location and timezone requirements", () => {
      const candidate = createCandidate({
        currentCountry: "US",
        workAuthorizations: ["US"],
        timezone: "America/New_York"
      });
      const job = createJob({
        remoteScope: "COUNTRY_AND_TIMEZONE_LIMITED",
        remoteCountryCodes: ["US"],
        timezoneOffsetMinutes: [-300, -240]
      });

      const res = service.evaluate(candidate, job);
      assert.equal(res.overallStatus, "APPEARS_ELIGIBLE");
    });

    it("UNKNOWN: does NOT fall through to worldwide; evaluates to INSUFFICIENT_DATA check required", () => {
      const candidate = createCandidate();
      const job = createJob({
        remoteScope: "UNKNOWN",
        remoteCountryCodes: [],
        timezoneOffsetMinutes: []
      });

      const res = service.evaluate(candidate, job);
      assert.equal(res.overallStatus, "CHECK_REQUIRED");
      const locDim = res.dimensions.find((d) => d.dimension === "LOCATION")!;
      assert.equal(locDim.status, "INSUFFICIENT_DATA");
      assert.equal(locDim.reasonCode, ReasonCode.LOC_SCOPE_UNKNOWN_CHECK_REQUIRED);
    });
  });

  it("returns APPEARS_ELIGIBLE when candidate resides in target country", () => {
    const candidate = createCandidate({ currentCountry: "US", workAuthorizations: [] });
    const job = createJob({ remoteCountryCodes: ["US"] });

    const res = service.evaluate(candidate, job);
    assert.equal(res.overallStatus, "APPEARS_ELIGIBLE");
    assert.equal(res.primaryReasonCode, ReasonCode.LOC_COUNTRY_CITIZEN_RESIDENT);
  });

  it("returns CONFLICT when candidate is neither resident nor authorized in target country", () => {
    const candidate = createCandidate({ currentCountry: "PK", workAuthorizations: ["PK"] });
    const job = createJob({ remoteCountryCodes: ["US", "CA"] });

    const res = service.evaluate(candidate, job);
    assert.equal(res.overallStatus, "CONFLICT");
    assert.equal(res.primaryReasonCode, ReasonCode.LOC_COUNTRY_NOT_AUTHORIZED);
    assert.equal(res.badgeText, "Eligibility conflict");
  });

  it("returns CHECK_REQUIRED when job contains unverified country restrictions", () => {
    const candidate = createCandidate();
    const job = createJob({
      remoteCountryCodes: ["US"],
      unresolvedLabels: ["Unknown Custom Free Trade Zone"]
    });

    const res = service.evaluate(candidate, job);
    assert.equal(res.overallStatus, "CHECK_REQUIRED");
    assert.equal(res.primaryReasonCode, ReasonCode.LOC_COUNTRY_UNRESOLVED_INSPECTION);
    assert.equal(res.badgeText, "Check required");
  });

  it("applies jurisdiction-specific sponsorship lock: authorized candidate needing sponsorship does not downgrade result", () => {
    const candidate = createCandidate({
      currentCountry: "US",
      workAuthorizations: ["US"],
      requiresVisaSponsorship: true
    });
    const job = createJob({ remoteCountryCodes: ["US"] });

    const res = service.evaluate(candidate, job);
    assert.equal(res.overallStatus, "APPEARS_ELIGIBLE");
    const sponDim = res.dimensions.find((d) => d.dimension === "SPONSORSHIP")!;
    assert.equal(sponDim.status, "SATISFIED");
    assert.equal(sponDim.reasonCode, ReasonCode.SPON_SELF_AUTHORIZED_IN_TARGET);
  });

  it("returns CHECK_REQUIRED (never CONFLICT) when candidate offset falls outside job declared band", () => {
    const candidate = createCandidate({ timezone: "Asia/Karachi" }); // UTC+5 (+300)
    const job = createJob({ timezoneOffsetMinutes: [-300, -240] }); // US offsets

    const res = service.evaluate(candidate, job);
    assert.equal(res.overallStatus, "CHECK_REQUIRED");
    assert.equal(res.primaryReasonCode, ReasonCode.TZ_OUTSIDE_DECLARED_OFFSET);
    assert.notEqual(res.overallStatus, "CONFLICT");
  });

  describe("Job Availability Separation", () => {
    it("expired job retains factual eligibility status while jobAvailability.canApply is false", () => {
      const candidate = createCandidate({
        currentCountry: "US",
        workAuthorizations: ["US"],
        timezone: "America/New_York"
      });
      const job = createJob({
        jobStatus: "EXPIRED",
        remoteCountryCodes: ["US"],
        timezoneOffsetMinutes: [-300, -240]
      });

      const res = service.evaluate(candidate, job);
      // Factual dimensions are satisfied:
      assert.equal(res.overallStatus, "APPEARS_ELIGIBLE");
      // But availability reflects expiration and disables apply:
      assert.equal(res.jobAvailability.status, "EXPIRED");
      assert.equal(res.jobAvailability.canApply, false);
      assert.equal(res.isJobExpired, true);
    });

    it("active CHECK_REQUIRED job keeps jobAvailability.canApply=true", () => {
      const candidate = createCandidate({ timezone: "Asia/Karachi" });
      const job = createJob({ timezoneOffsetMinutes: [-300, -240] });

      const res = service.evaluate(candidate, job);
      assert.equal(res.overallStatus, "CHECK_REQUIRED");
      assert.equal(res.jobAvailability.status, "ACTIVE");
      assert.equal(res.jobAvailability.canApply, true);
    });

    it("active CONFLICT job keeps jobAvailability.canApply=true so candidate retains autonomy", () => {
      const candidate = createCandidate({ currentCountry: "PK", workAuthorizations: ["PK"] });
      const job = createJob({ remoteCountryCodes: ["US"] });

      const res = service.evaluate(candidate, job);
      assert.equal(res.overallStatus, "CONFLICT");
      assert.equal(res.jobAvailability.status, "ACTIVE");
      assert.equal(res.jobAvailability.canApply, true);
    });

    it("active job missing application URL sets canApply=false with descriptive reason", () => {
      const candidate = createCandidate();
      const job = createJob({ applicationUrl: null });

      const res = service.evaluate(candidate, job);
      assert.equal(res.jobAvailability.canApply, false);
      assert.equal(res.jobAvailability.reason, "No direct application link available for this role.");
    });
  });
});
