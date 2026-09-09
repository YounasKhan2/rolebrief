import assert from "node:assert/strict";
import test from "node:test";
import { GoneException } from "@nestjs/common";
import { RadarRankingService } from "./radar-ranking.service";
import { RadarService } from "./radar.service";
import type { RadarCandidate, RadarSnapshot } from "./radar.types";

test("RadarService caps enrichment to 120 and evaluates in 50-item chunks", async () => {
  const harness = createHarness(candidates(130));

  const result = await harness.service.feed("user-1", { limit: 20, sort: "relevance" } as any);

  assert.equal(result.candidateCounts.sqlCandidates, 130);
  assert.equal(result.candidateCounts.enrichmentCandidates, 120);
  assert.equal(result.candidateCounts.ranked, 120);
  assert.deepEqual(harness.matchChunkSizes, [50, 50, 20]);
  assert.deepEqual(harness.eligibilityChunkSizes, [50, 50, 20]);
});

test("RadarService applies alignment and no-known-conflicts as hard post-enrichment filters", async () => {
  const harness = createHarness(candidates(4), {
    matchStatuses: new Map([
      ["job-1", "STRONG_ALIGNMENT"],
      ["job-2", "PARTIAL_ALIGNMENT"],
      ["job-3", "STRONG_ALIGNMENT"],
      ["job-4", "STRONG_ALIGNMENT"]
    ]),
    eligibilityStatuses: new Map([
      ["job-1", "APPEARS_ELIGIBLE"],
      ["job-2", "APPEARS_ELIGIBLE"],
      ["job-3", "CONFLICT"],
      ["job-4", "CHECK_REQUIRED"]
    ])
  });

  const result = await harness.service.feed("user-1", {
    limit: 20,
    sort: "relevance",
    alignment: ["STRONG_ALIGNMENT"],
    eligibility: "NO_KNOWN_CONFLICTS"
  } as any);

  assert.deepEqual(result.data.map((item: any) => item.job.slug), ["job-1"]);
});

test("RadarService rejects cross-user cursors instead of rebuilding mid-pagination", async () => {
  const harness = createHarness(candidates(25));
  const first = await harness.service.feed("user-1", { limit: 5, sort: "relevance" } as any);

  await assert.rejects(
    () => harness.service.feed("user-2", { limit: 5, sort: "relevance", cursor: first.pageInfo.nextCursor } as any),
    GoneException
  );
});

test("RadarService returns 410 when the signed snapshot is missing", async () => {
  const harness = createHarness(candidates(25));
  const first = await harness.service.feed("user-1", { limit: 5, sort: "relevance" } as any);
  harness.snapshots.clear();

  await assert.rejects(
    () => harness.service.feed("user-1", { limit: 5, sort: "relevance", cursor: first.pageInfo.nextCursor } as any),
    GoneException
  );
});

test("RadarService omits nextCursor when Redis cannot store the first-page snapshot", async () => {
  const harness = createHarness(candidates(25), { cacheStored: false });

  const result = await harness.service.feed("user-1", { limit: 5, sort: "relevance" } as any);

  assert.equal(result.pageInfo.hasNextPage, false);
  assert.equal(result.pageInfo.nextCursor, null);
  assert.deepEqual(result.warnings, ["RADAR_SNAPSHOT_CACHE_UNAVAILABLE"]);
});

test("RadarService counts new Radar roles from immutable firstSeenAt, not provider freshness", async () => {
  const oldFirstSeen = new Date("2026-08-01T00:00:00.000Z");
  const freshProviderUpdate = new Date();
  const harness = createHarness([
    {
      ...candidates(1)[0],
      id: "old-id",
      slug: "old-first-seen",
      firstSeenAt: oldFirstSeen,
      publishedAt: freshProviderUpdate
    }
  ]);

  const result = await harness.service.feed("user-1", { limit: 20, sort: "relevance" } as any);

  assert.equal(result.summary.newRadarRoles, 0);
});

test("RadarService keeps a feed usable when live overlays and evaluators fail", async () => {
  const harness = createHarness(candidates(3), {
    failSaved: true,
    failTracked: true,
    failMatch: true,
    failEligibility: true
  });

  const result = await harness.service.feed("user-1", { limit: 20, sort: "relevance" } as any);

  assert.equal(result.data.length, 3);
  const first = result.data[0]!;
  assert.equal(first.saved, null);
  assert.equal(first.tracked, null);
  assert.ok(result.warnings.includes("RADAR_SAVED_STATE_UNAVAILABLE"));
  assert.ok(result.warnings.includes("RADAR_TRACKER_STATE_UNAVAILABLE"));
  assert.ok(result.warnings.includes("RADAR_MATCH_BRIEF_UNAVAILABLE"));
  assert.ok(result.warnings.includes("RADAR_ELIGIBILITY_UNAVAILABLE"));
});

function createHarness(
  candidateRows: RadarCandidate[],
  options: {
    cacheStored?: boolean;
    matchStatuses?: Map<string, string>;
    eligibilityStatuses?: Map<string, string>;
    failSaved?: boolean;
    failTracked?: boolean;
    failMatch?: boolean;
    failEligibility?: boolean;
  } = {}
) {
  const snapshots = new Map<string, RadarSnapshot>();
  const matchChunkSizes: number[] = [];
  const eligibilityChunkSizes: number[] = [];
  let snapshotSeq = 0;
  const prisma = {
    job: {
      findMany: async ({ where }: any) => where.id.in.map((id: string) => ({ id, slug: candidateRows.find((row) => row.id === id)?.slug }))
    },
    savedItem: {
      count: async () => 0,
      findMany: async () => {
        if (options.failSaved) throw new Error("saved unavailable");
        return [];
      }
    },
    application: {
      count: async () => 0,
      findMany: async () => {
        if (options.failTracked) throw new Error("tracker unavailable");
        return [];
      }
    }
  };
  const jobs = {
    include: () => ({}),
    serialize: (job: any) => ({ id: job.id, slug: job.slug, workMode: "REMOTE" })
  };
  const queryService = {
    profileSnapshot: async () => ({ revision: 7, preferences: { remotePreference: null, employmentTypes: [] } }),
    generateCandidates: async () => candidateRows
  };
  const cache = {
    createSnapshotId: () => `snapshot-${++snapshotSeq}`,
    get: async (id: string) => snapshots.get(id) ?? null,
    set: async (snapshot: RadarSnapshot) => {
      if (options.cacheStored === false) return false;
      snapshots.set(snapshot.feedSnapshotId, snapshot);
      return true;
    }
  };
  const matchBriefs = {
    evaluateBatch: async (_userId: string, slugs: string[]) => {
      matchChunkSizes.push(slugs.length);
      if (options.failMatch) throw new Error("match unavailable");
      return slugs.map((slug) => ({
        jobSlug: slug,
        status: options.matchStatuses?.get(slug) ?? "NOT_CALCULATED",
        label: options.matchStatuses?.get(slug) ?? "Not calculated",
        comparableDimensionCount: 0,
        coveragePercent: 0,
        engineVersion: "match-brief-v1",
        taxonomyVersion: "title-taxonomy-v1",
        scorePercent: null,
        primaryReasonCode: "TEST",
        strengths: [],
        gaps: [],
        unknowns: [],
        profileRevision: 7,
        jobMatchVersion: "test",
        calculatedAt: new Date().toISOString()
      }))
    }
  };
  const eligibility = {
    evaluateBatch: async (_userId: string, slugs: string[]) => {
      eligibilityChunkSizes.push(slugs.length);
      if (options.failEligibility) throw new Error("eligibility unavailable");
      return slugs.map((slug) => ({
        slug,
        overallStatus: options.eligibilityStatuses?.get(slug) ?? "NOT_CALCULATED",
        primaryReasonCode: "PROFILE_INCOMPLETE",
        badgeText: "Unknown",
        headline: "Unknown",
        jobAvailability: { status: "ACTIVE", canApply: true, reason: null },
        isJobExpired: false
      }))
    }
  };
  const service = new RadarService(
    prisma as any,
    { cursorSigningSecret: "radar-service-test-secret-at-least-32-chars" } as any,
    jobs as any,
    queryService as any,
    cache as any,
    new RadarRankingService(),
    matchBriefs as any,
    eligibility as any
  );
  return { service, snapshots, matchChunkSizes, eligibilityChunkSizes };
}

function candidates(count: number): RadarCandidate[] {
  const now = new Date("2026-09-09T00:00:00.000Z");
  return Array.from({ length: count }, (_, index) => ({
    id: `id-${index + 1}`,
    slug: `job-${index + 1}`,
    title: `Job ${index + 1}`,
    status: "ACTIVE",
    workMode: "REMOTE",
    employmentType: "FULL_TIME",
    seniority: "Senior",
    firstSeenAt: now,
    publishedAt: now,
    applicationDeadlineAt: null,
    applicationUrl: "https://example.com/apply",
    companyName: "Example",
    laneReasons: [],
    cheapRank: index
  }));
}
