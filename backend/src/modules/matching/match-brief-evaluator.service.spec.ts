import test from "node:test";
import assert from "node:assert/strict";
import { EmploymentType, RemotePreference, SalaryPeriod, SeniorityLevel, WorkMode } from "@prisma/client";
import { MatchBriefEvaluatorService } from "./match-brief-evaluator.service";
import { CandidateMatchFacts, JobMatchFacts } from "./match-brief.types";

const evaluator = new MatchBriefEvaluatorService();

function candidate(overrides: Partial<CandidateMatchFacts> = {}): CandidateMatchFacts {
  return {
    userId: "u1",
    revision: 3,
    targetRoleTitles: ["Frontend Engineer"],
    seniorityLevel: SeniorityLevel.SENIOR,
    remotePreference: RemotePreference.REMOTE_ONLY,
    employmentTypes: [EmploymentType.FULL_TIME],
    minSalary: 100000,
    maxSalary: null,
    salaryCurrency: "USD",
    salaryPeriod: SalaryPeriod.ANNUAL,
    ...overrides
  };
}

function job(overrides: Partial<JobMatchFacts> = {}): JobMatchFacts {
  return {
    id: "j1",
    slug: "senior-frontend-engineer",
    title: "Senior Frontend Engineer",
    seniority: "Senior",
    employmentType: "Full-time",
    workMode: WorkMode.REMOTE,
    salary: { min: 120000, max: 140000, currency: "USD", period: "ANNUAL" },
    ...overrides
  };
}

test("returns NOT_CALCULATED when fewer than two approved dimensions are comparable", () => {
  const result = evaluator.evaluate(
    candidate({ targetRoleTitles: [], seniorityLevel: null, remotePreference: null, employmentTypes: [], minSalary: null }),
    job({ salary: null })
  );
  assert.equal(result.status, "NOT_CALCULATED");
  assert.equal(result.scorePercent, null);
  assert.equal(result.comparableDimensionCount, 0);
  assert.equal(result.coveragePercent, 0);
});

test("calculates strong alignment without rendering a numeric score", () => {
  const result = evaluator.evaluate(candidate(), job({ title: "Frontend Engineer" }));
  assert.equal(result.status, "STRONG_ALIGNMENT");
  assert.equal(result.scorePercent, null);
  assert.equal(result.coveragePercent, 100);
  assert.equal(result.dimensions.find((d) => d.dimension === "TITLE")?.reasonCode, "TITLE_EXACT_MATCH");
});

test("unknown applicable dimensions do not count as gaps and reduce coverage", () => {
  const result = evaluator.evaluate(candidate({ minSalary: 100000 }), job({ title: "Frontend Engineer", salary: null }));
  assert.equal(result.status, "STRONG_ALIGNMENT");
  assert.equal(result.dimensions.find((d) => d.dimension === "COMPENSATION")?.status, "UNKNOWN");
  assert.equal(result.coveragePercent, 80);
});

test("confirmed gaps can produce limited alignment", () => {
  const result = evaluator.evaluate(
    candidate({ targetRoleTitles: ["Product Manager"], remotePreference: RemotePreference.REMOTE_ONLY }),
    job({ title: "Product Designer", workMode: WorkMode.ONSITE, salary: null })
  );
  assert.equal(result.status, "LIMITED_ALIGNMENT");
  assert.ok(result.gaps.length >= 2);
});

test("currency and period mismatches are unknown rather than gaps", () => {
  const currencyMismatch = evaluator.evaluate(candidate(), job({ salary: { min: 120000, max: 140000, currency: "EUR", period: "ANNUAL" } }));
  assert.equal(currencyMismatch.dimensions.find((d) => d.dimension === "COMPENSATION")?.reasonCode, "COMPENSATION_CURRENCY_MISMATCH");
  assert.equal(currencyMismatch.dimensions.find((d) => d.dimension === "COMPENSATION")?.status, "UNKNOWN");

  const periodMismatch = evaluator.evaluate(candidate(), job({ salary: { min: 10000, max: 12000, currency: "USD", period: "MONTHLY" } }));
  assert.equal(periodMismatch.dimensions.find((d) => d.dimension === "COMPENSATION")?.reasonCode, "COMPENSATION_PERIOD_MISMATCH");
  assert.equal(periodMismatch.dimensions.find((d) => d.dimension === "COMPENSATION")?.status, "UNKNOWN");
});

test("salary below candidate minimum is a confirmed compensation gap", () => {
  const result = evaluator.evaluate(candidate(), job({ title: "Frontend Engineer", salary: { min: 70000, max: 90000, currency: "USD", period: "ANNUAL" } }));
  const compensation = result.dimensions.find((d) => d.dimension === "COMPENSATION");
  assert.equal(compensation?.status, "GAP");
  assert.equal(compensation?.reasonCode, "COMPENSATION_BELOW_MINIMUM");
});

