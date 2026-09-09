import assert from "node:assert/strict";
import test from "node:test";
import { RadarRankingService } from "./radar-ranking.service";
import type { RadarCandidate } from "./radar.types";

const now = new Date("2026-09-09T00:00:00.000Z");

function candidate(partial: Partial<RadarCandidate> & { id: string; slug: string }): RadarCandidate {
  return {
    title: partial.slug,
    status: "ACTIVE",
    workMode: "REMOTE",
    employmentType: "FULL_TIME",
    seniority: null,
    firstSeenAt: now,
    publishedAt: now,
    applicationDeadlineAt: null,
    applicationUrl: "https://example.com/apply",
    companyName: "Example",
    laneReasons: [],
    cheapRank: 0,
    ...partial
  };
}

test("ranking demotes eligibility conflicts but keeps them visible", () => {
  const service = new RadarRankingService();
  const ranked = service.rank({
    candidates: [candidate({ id: "3", slug: "conflict" }), candidate({ id: "2", slug: "check" }), candidate({ id: "1", slug: "eligible" })],
    trackedAtSnapshot: new Set(),
    preference: { workMode: null, employmentTypes: [] },
    sort: "relevance",
    matchBriefs: new Map(),
    eligibility: new Map([
      ["conflict", { slug: "conflict", overallStatus: "CONFLICT", primaryReasonCode: "PROFILE_INCOMPLETE" as any, badgeText: "Conflict", headline: "Conflict", jobAvailability: { status: "ACTIVE", canApply: true, reason: null }, isJobExpired: false }],
      ["check", { slug: "check", overallStatus: "CHECK_REQUIRED", primaryReasonCode: "PROFILE_INCOMPLETE" as any, badgeText: "Check", headline: "Check", jobAvailability: { status: "ACTIVE", canApply: true, reason: null }, isJobExpired: false }],
      ["eligible", { slug: "eligible", overallStatus: "APPEARS_ELIGIBLE", primaryReasonCode: "PROFILE_INCOMPLETE" as any, badgeText: "Eligible", headline: "Eligible", jobAvailability: { status: "ACTIVE", canApply: true, reason: null }, isJobExpired: false }]
    ])
  });

  assert.deepEqual(ranked.map((item) => item.slug), ["eligible", "check", "conflict"]);
});

test("tracked jobs are demoted inside the snapshot but not removed", () => {
  const service = new RadarRankingService();
  const ranked = service.rank({
    candidates: [candidate({ id: "2", slug: "tracked" }), candidate({ id: "1", slug: "untracked" })],
    trackedAtSnapshot: new Set(["tracked"]),
    preference: { workMode: null, employmentTypes: [] },
    sort: "relevance",
    matchBriefs: new Map(),
    eligibility: new Map()
  });

  assert.deepEqual(ranked.map((item) => item.slug), ["untracked", "tracked"]);
});

test("freshest sort uses freshness boundary before stable id", () => {
  const service = new RadarRankingService();
  const ranked = service.rank({
    candidates: [
      candidate({ id: "1", slug: "old", publishedAt: new Date("2026-09-01T00:00:00.000Z") }),
      candidate({ id: "2", slug: "new", publishedAt: new Date("2026-09-08T00:00:00.000Z") })
    ],
    trackedAtSnapshot: new Set(),
    preference: { workMode: null, employmentTypes: [] },
    sort: "freshest",
    matchBriefs: new Map(),
    eligibility: new Map()
  });

  assert.equal(ranked[0].slug, "new");
});
