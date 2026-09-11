import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError } from "../core/api";
import {
  appendUniqueRadarJobs,
  isFeedSnapshotExpired,
  radarParamsKey,
  type RadarJob
} from "./radar-api";

test("radarParamsKey is stable for equivalent filters and changes when filters change", () => {
  const base = radarParamsKey({ limit: 20, sort: "relevance", eligibility: "INCLUDE_ALL" });
  const same = radarParamsKey({ eligibility: "INCLUDE_ALL", sort: "relevance", limit: 20 });
  const changed = radarParamsKey({ limit: 20, sort: "freshest", eligibility: "INCLUDE_ALL" });

  assert.equal(base, same);
  assert.notEqual(base, changed);
});

test("appendUniqueRadarJobs preserves server order and ignores duplicate cards", () => {
  const current = [job("a"), job("b")];
  const next = appendUniqueRadarJobs(current, [job("b"), job("c"), job("d"), job("c")]);

  assert.deepEqual(next.map((item) => item.slug), ["a", "b", "c", "d"]);
});

test("appendUniqueRadarJobs keeps existing cards after failed next-page request model", () => {
  const current = [job("a"), job("b")];
  const afterFailure = appendUniqueRadarJobs(current, []);

  assert.deepEqual(afterFailure.map((item) => item.slug), ["a", "b"]);
});

test("isFeedSnapshotExpired identifies the controlled 410 refresh-recovery condition", () => {
  assert.equal(
    isFeedSnapshotExpired(new ApiError("expired", "http", 410, undefined, { code: "FEED_SNAPSHOT_EXPIRED" })),
    true
  );
  assert.equal(isFeedSnapshotExpired(new ApiError("rate limited", "http", 429, 30)), false);
});

test("thirty seconds idle model creates no next-page request without observer or button action", async () => {
  let nextPageRequests = 0;
  const loadMore = () => {
    nextPageRequests += 1;
  };

  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(nextPageRequests, 0);

  loadMore();
  assert.equal(nextPageRequests, 1);
});

function job(slug: string): RadarJob {
  return {
    slug,
    title: slug,
    companySlug: "company",
    companyName: "Company",
    companyLogoUrl: null,
    locations: [],
    workModel: "Remote",
    remoteEligibility: "unknown",
    remoteRestrictionsText: "Remote",
    seniority: "Unknown",
    employmentType: "Unknown",
    discipline: "Other",
    skills: [],
    salary: null,
    source: "Himalayas",
    sourceUrl: "https://himalayas.app/jobs",
    applyUrl: "https://himalayas.app/jobs",
    applyDomain: "himalayas.app",
    freshness: [],
    eligibility: { state: "unknown", reasons: [] },
    match: { score: 0, dimensions: [], evidence: [], missing: [], ambiguous: [], suggestions: [] },
    reasons: [],
    description: {
      overview: "",
      html: null,
      responsibilities: [],
      required: [],
      preferred: [],
      benefits: [],
      workAuthorization: ""
    },
    radarRank: 1,
    saved: false,
    tracked: false,
    jobAvailability: { status: "ACTIVE", canApply: true, reason: null },
    eligibilitySummary: null
  };
}
