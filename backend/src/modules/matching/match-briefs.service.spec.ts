import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { EmploymentType, RemotePreference, SalaryPeriod, SeniorityLevel, WorkMode } from "@prisma/client";
import { MatchBriefEvaluatorService } from "./match-brief-evaluator.service";
import { MatchBriefsService } from "./match-briefs.service";

function createService(jobs: any[], profile: any = defaultProfile()) {
  const prisma = {
    candidateProfile: {
      findUnique: async () => profile
    },
    job: {
      findMany: async ({ where }: any) => jobs.filter((job) => where.slug.in.includes(job.slug)),
      findUnique: async ({ where }: any) => jobs.find((job) => job.slug === where.slug) ?? null
    }
  };
  const config = { redisUrl: "redis://127.0.0.1:0" };
  return new MatchBriefsService(prisma as any, config as any, new MatchBriefEvaluatorService());
}

function defaultProfile() {
  return {
    revision: 7,
    seniorityLevel: SeniorityLevel.SENIOR,
    preferences: {
      targetRoleTitles: ["Frontend Engineer"],
      remotePreference: RemotePreference.REMOTE_ONLY,
      employmentTypes: [EmploymentType.FULL_TIME],
      minSalary: 100000,
      maxSalary: null,
      salaryCurrency: "USD",
      salaryPeriod: SalaryPeriod.ANNUAL
    }
  };
}

function job(slug: string, title: string, overrides: any = {}) {
  return {
    id: `id-${slug}`,
    slug,
    canonicalTitle: title,
    seniority: "Senior",
    employmentType: "Full-time",
    workMode: WorkMode.REMOTE,
    salaries: [{ min: 120000, max: 140000, currency: "USD", period: "ANNUAL" }],
    ...overrides
  };
}

test("MatchBriefsService preserves batch input order", async () => {
  const service = createService([
    job("backend-engineer", "Backend Engineer"),
    job("frontend-engineer", "Frontend Engineer")
  ]);
  const result = await service.evaluateBatch("user-1", ["frontend-engineer", "backend-engineer"]);
  assert.deepEqual(result.map((item) => item.jobSlug), ["frontend-engineer", "backend-engineer"]);
  await service.onModuleDestroy();
});

test("MatchBriefsService rejects duplicate batch slugs", async () => {
  const service = createService([job("frontend-engineer", "Frontend Engineer")]);
  await assert.rejects(
    () => service.evaluateBatch("user-1", ["frontend-engineer", "frontend-engineer"]),
    BadRequestException
  );
  await service.onModuleDestroy();
});

test("MatchBriefsService omits missing jobs from batch and throws 404 for detail", async () => {
  const service = createService([job("frontend-engineer", "Frontend Engineer")]);
  const batch = await service.evaluateBatch("user-1", ["frontend-engineer", "missing-job"]);
  assert.deepEqual(batch.map((item) => item.jobSlug), ["frontend-engineer"]);
  await assert.rejects(() => service.evaluateJob("user-1", "missing-job"), NotFoundException);
  await service.onModuleDestroy();
});

test("MatchBriefsService produces NOT_CALCULATED when profile facts are insufficient", async () => {
  const service = createService(
    [job("frontend-engineer", "Frontend Engineer")],
    { revision: 1, seniorityLevel: null, preferences: null }
  );
  const [summary] = await service.evaluateBatch("user-1", ["frontend-engineer"]);
  assert.equal(summary.status, "NOT_CALCULATED");
  assert.equal(summary.scorePercent, null);
  await service.onModuleDestroy();
});

