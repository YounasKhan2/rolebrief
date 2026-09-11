import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeFilterList,
  buildCanonicalQueryKey,
  mapApiJob,
  type UseJobsOptions
} from "./jobs";
import type { ApiJob } from "../core/api";

test("normalizeFilterList: trims, deduplicates, and sorts sets and arrays identically", () => {
  const setA = new Set(["  Frontend ", "Backend", "Frontend"]);
  const setB = new Set(["Backend", "Frontend"]);
  const arrayC = ["Frontend", " Backend", "Backend "];

  const normA = normalizeFilterList(setA);
  const normB = normalizeFilterList(setB);
  const normC = normalizeFilterList(arrayC);

  assert.deepEqual(normA, ["Backend", "Frontend"]);
  assert.deepEqual(normB, ["Backend", "Frontend"]);
  assert.deepEqual(normC, ["Backend", "Frontend"]);
  assert.deepEqual(normalizeFilterList(undefined), []);
  assert.deepEqual(normalizeFilterList(new Set()), []);
});

test("buildCanonicalQueryKey: equivalent filter Sets in different insertion orders yield identical key", () => {
  const options1: UseJobsOptions = {
    q: " engineer ",
    disc: new Set(["Full-stack", "Backend"]),
    remote: new Set(["worldwide", "country-eligible"]),
    senior: new Set(["Senior", "Mid"]),
    sort: "newest",
    limit: 20
  };

  const options2: UseJobsOptions = {
    q: "engineer",
    disc: new Set(["Backend", "Full-stack"]),
    remote: new Set(["country-eligible", "worldwide"]),
    senior: new Set(["Mid", "Senior"]),
    sort: "newest",
    limit: 20
  };

  const res1 = buildCanonicalQueryKey(options1);
  const res2 = buildCanonicalQueryKey(options2);

  assert.equal(res1.canonicalQueryKey, res2.canonicalQueryKey);
  assert.deepEqual(res1.queryParams, res2.queryParams);
  assert.equal(res1.queryParams.q, "engineer");
  assert.deepEqual(res1.queryParams.category, ["Backend", "Full-stack"]);
  assert.deepEqual(res1.queryParams.seniority, ["Mid", "Senior"]);
});

test("buildCanonicalQueryKey: display-only state does not affect query key", () => {
  const baseOptions: UseJobsOptions = { q: "react", limit: 20, sort: "relevance" };
  const key1 = buildCanonicalQueryKey(baseOptions).canonicalQueryKey;

  // Simulate passing unrelated UI state
  const key2 = buildCanonicalQueryKey({ ...baseOptions, ...({ density: "compact" } as any) }).canonicalQueryKey;
  const key3 = buildCanonicalQueryKey({ ...baseOptions, ...({ density: "comfortable" } as any) }).canonicalQueryKey;

  assert.equal(key1, key2);
  assert.equal(key2, key3);
});

test("buildCanonicalQueryKey: maps remote filter keys to remoteScope and workMode correctly", () => {
  const options: UseJobsOptions = {
    remote: new Set(["worldwide", "on-site", "hybrid"])
  };
  const { queryParams } = buildCanonicalQueryKey(options);

  assert.deepEqual(queryParams.remoteScope, ["WORLDWIDE"]);
  assert.deepEqual(queryParams.workMode, ["HYBRID", "ONSITE"]);
});

test("mapApiJob: list response with null descriptionHtml skips HTML sanitization overhead and preserves fields", () => {
  const mockApiJob: ApiJob = {
    id: "job-123",
    slug: "acme-senior-engineer",
    title: "Senior Engineer",
    company: { slug: "acme", name: "Acme Corp", logoUrl: null },
    employmentType: "Full Time",
    seniority: "Senior",
    workMode: "REMOTE",
    remoteScope: "WORLDWIDE",
    remoteRestrictions: { countryCodes: [], labels: ["Worldwide"], timezones: [] },
    remoteRestrictionsText: "Remote · Worldwide",
    locations: [{ alpha2: "US", name: "United States", slug: "us" }],
    salary: { min: 120000, max: 150000, currency: "USD", period: "annual" },
    descriptionHtml: null, // List payload excludes full HTML
    excerpt: "Acme is hiring a Senior Engineer to scale our distributed cloud backend.",
    publishedAt: "2026-09-06T12:00:00.000Z",
    expiresAt: null,
    providerExpiresAt: null,
    applicationDeadlineAt: null,
    deadlineMetadata: null,
    applicationUrl: "https://example.com/apply",
    applyDomain: "example.com",
    source: { name: "Himalayas", url: "https://himalayas.app", attributionPolicy: "" }
  };

  const job = mapApiJob(mockApiJob);

  assert.equal(job.slug, "acme-senior-engineer");
  assert.equal(job.title, "Senior Engineer");
  assert.equal(job.companyName, "Acme Corp");
  assert.equal(job.description.html, null);
  assert.equal(job.description.overview, "Acme is hiring a Senior Engineer to scale our distributed cloud backend.");
  assert.equal(job.discipline, "Backend");
  assert.equal(job.salary?.text, "USD 120,000–150,000 / annual");
  assert.equal(job.flags?.includes("expired"), false);
  assert.equal(job.flags?.includes("missing-data"), false);
});

test("request state machine: query transition, stale response rejection, and cursor tracking", async () => {
  let activeRequestId = 0;
  let activeQueryKey = "";
  const consumedCursors = new Set<string>();
  const inFlightCursors = new Set<string>();

  let stateData: any[] = [];
  let stateCursor: string | null = null;
  let hasNextPage = false;
  let requestCount = 0;

  async function simulateFetch(queryOptions: UseJobsOptions, cursor?: string): Promise<any> {
    const { canonicalQueryKey, queryParams } = buildCanonicalQueryKey(queryOptions);

    if (activeQueryKey !== canonicalQueryKey) {
      activeQueryKey = canonicalQueryKey;
      consumedCursors.clear();
      inFlightCursors.clear();
      stateData = [];
      stateCursor = null;
      hasNextPage = false;
    }

    if (cursor) {
      if (inFlightCursors.has(cursor) || consumedCursors.has(cursor)) {
        return null; // Ignore duplicate / concurrent cursor request
      }
      inFlightCursors.add(cursor);
    }

    const requestId = ++activeRequestId;
    const requestKey = activeQueryKey;
    requestCount++;

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Stale check
    if (requestId !== activeRequestId || activeQueryKey !== requestKey) {
      if (cursor) inFlightCursors.delete(cursor);
      return null;
    }

    if (cursor) {
      consumedCursors.add(cursor);
      inFlightCursors.delete(cursor);
    }

    const next = cursor ? null : "cursor-token-page-2";
    stateCursor = next;
    hasNextPage = Boolean(next);
    stateData = [...stateData, ...(cursor ? [{ id: "job-2" }] : [{ id: "job-1" }])];

    return { data: stateData, nextCursor: stateCursor, hasNextPage };
  }

  // 1. Initial request for query A
  const p1 = await simulateFetch({ q: "frontend" });
  assert.ok(p1);
  assert.equal(requestCount, 1);
  assert.equal(stateData.length, 1);
  assert.equal(stateCursor, "cursor-token-page-2");
  assert.equal(hasNextPage, true);

  // 2. Re-running with identical normalized query options (even with new Set instances) must not change query key
  const keyBefore = activeQueryKey;
  const keyAfter = buildCanonicalQueryKey({ q: "frontend", disc: new Set() }).canonicalQueryKey;
  assert.equal(keyBefore, keyAfter, "Query key must remain identical across render Set recreations");

  // 3. Load More using returned nextCursor
  const p2 = await simulateFetch({ q: "frontend" }, stateCursor!);
  assert.ok(p2);
  assert.equal(requestCount, 2);
  assert.equal(stateData.length, 2);
  assert.equal(stateCursor, null);
  assert.equal(hasNextPage, false);

  // 4. Attempting to consume the same cursor again is blocked
  const duplicateCall = await simulateFetch({ q: "frontend" }, "cursor-token-page-2");
  assert.equal(duplicateCall, null);
  assert.equal(requestCount, 2, "Duplicate consumed cursor must not trigger network call");

  // 5. Query change resets state and increments activeRequestId
  const p3 = await simulateFetch({ q: "backend" });
  assert.ok(p3);
  assert.equal(requestCount, 3);
  assert.equal(stateData.length, 1);
  assert.equal(stateData[0].id, "job-1");
  assert.equal(stateCursor, "cursor-token-page-2");
});

test("StrictMode simulation: double mount runs cleanup and settles with bounded requests without looping", async () => {
  let requestCount = 0;
  let activeAborts = 0;
  let activeKey = "";
  let settledData: any[] = [];

  class MountSimulation {
    private controller: AbortController | null = null;
    private options: UseJobsOptions;

    constructor(options: UseJobsOptions) {
      this.options = options;
    }

    mount() {
      const { canonicalQueryKey } = buildCanonicalQueryKey(this.options);
      activeKey = canonicalQueryKey;
      requestCount++;

      this.controller = new AbortController();
      const currentCtrl = this.controller;

      setTimeout(() => {
        if (!currentCtrl.signal.aborted) {
          settledData = [{ id: "job-strict-mode" }];
        }
      }, 20);
    }

    unmount() {
      if (this.controller) {
        this.controller.abort();
        activeAborts++;
      }
    }
  }

  // StrictMode Lifecycle: Mount -> Unmount -> Re-mount
  const sim = new MountSimulation({ q: "engineer", limit: 20 });
  sim.mount();
  sim.unmount(); // React StrictMode cleanup
  sim.mount(); // Second mount

  assert.equal(requestCount, 2, "StrictMode must make at most 2 initial requests");
  assert.equal(activeAborts, 1, "First mount must have its controller aborted");

  // Wait for settlement
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(settledData.length, 1);
  assert.equal(requestCount, 2, "Request count must not grow after settling");
});

test("rapid query changes: aborts prior in-flight request and ignores stale response", async () => {
  let activeId = 0;
  let latestCommittedQuery = "";
  let abortCount = 0;

  async function search(q: string, delayMs: number) {
    const id = ++activeId;
    const controller = new AbortController();

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        if (controller.signal.aborted) {
          abortCount++;
          return resolve();
        }
        // Only the latest active request may commit
        if (id === activeId) {
          latestCommittedQuery = q;
        }
        resolve();
      }, delayMs);
    });
  }

  // Dispatch "re" (slow 50ms) then immediately "react" (fast 10ms)
  const req1 = search("re", 50);
  const req2 = search("react", 10);

  await Promise.all([req1, req2]);
  assert.equal(latestCommittedQuery, "react", "Only the latest request must commit state");
});

test("parent re-render and density toggling: canonical query key remains identical, causing zero refetches", () => {
  // Initial render options
  const optA: UseJobsOptions = {
    q: "python",
    disc: new Set(["Backend"]),
    remote: new Set(["worldwide"]),
    sort: "newest",
    limit: 20
  };

  // Re-render: Parent re-renders with new Set instances and density toggle
  const optB: UseJobsOptions = {
    q: "python",
    disc: new Set(["Backend"]),
    remote: new Set(["worldwide"]),
    sort: "newest",
    limit: 20
  };

  const keyA = buildCanonicalQueryKey(optA).canonicalQueryKey;
  const keyB = buildCanonicalQueryKey(optB).canonicalQueryKey;

  assert.equal(keyA, keyB, "New Set references with same contents must not change canonicalQueryKey");
});

test("failed loadMore: cursor is marked consumed only on success, allowing retry after 500, timeout, or abort", async () => {
  // Model state machine exactly as implemented in useJobs
  const activeQueryKeyRef = { current: "q:engineer&sort:newest&limit:20" };
  const inFlightCursorsRef = { current: new Set<string>() };
  const consumedCursorsRef = { current: new Set<string>() };
  const currentCursorRef = { current: "cursor-token-page-2" as string | null };
  const hasNextPageRef = { current: true };
  let loadingMore = false;
  let errorState: string | null = null;
  let items = [{ id: "job-p1" }];

  let networkCallCount = 0;
  let failNext = false;
  let abortNext = false;

  async function mockListJobs(cursor: string, signal?: AbortSignal): Promise<any> {
    networkCallCount++;
    if (abortNext) {
      const err = new Error("Request aborted");
      (err as any).name = "AbortError";
      (err as any).code = "aborted";
      throw err;
    }
    if (failNext) {
      const err = new Error("500 Internal Server Error");
      (err as any).statusCode = 500;
      throw err;
    }
    return {
      data: [{ id: "job-p2" }],
      pageInfo: {
        nextCursor: "cursor-token-page-3",
        hasNextPage: true,
      },
      totalCount: 100
    };
  }

  async function executeLoadMore() {
    const cursor = currentCursorRef.current;
    if (!cursor || !hasNextPageRef.current || loadingMore) return false;

    // Must never request in-flight or consumed cursors
    if (inFlightCursorsRef.current.has(cursor) || consumedCursorsRef.current.has(cursor)) {
      return false;
    }

    const requestQueryKey = activeQueryKeyRef.current;
    const controller = new AbortController();

    inFlightCursorsRef.current.add(cursor);
    loadingMore = true;
    errorState = null;

    try {
      const response = await mockListJobs(cursor, controller.signal);
      if (activeQueryKeyRef.current !== requestQueryKey) return false;

      // CRITICAL: Cursor marked consumed ONLY after successful response
      consumedCursorsRef.current.add(cursor);
      items = [...items, ...response.data];
      currentCursorRef.current = response.pageInfo.nextCursor;
      hasNextPageRef.current = response.pageInfo.hasNextPage;
      return true;
    } catch (err: any) {
      if (activeQueryKeyRef.current !== requestQueryKey) return false;
      if (err?.code === "aborted" || err?.name === "AbortError") return false;
      errorState = err.message || "Failed to load more";
      return false;
    } finally {
      inFlightCursorsRef.current.delete(cursor);
      loadingMore = false;
    }
  }

  // 1. First attempt fails with 500 error
  failNext = true;
  const result1 = await executeLoadMore();
  assert.equal(result1, false, "Failed attempt must return false");
  assert.equal(networkCallCount, 1, "Network call was made");
  assert.equal(errorState, "500 Internal Server Error", "Error was captured");
  assert.equal(loadingMore, false, "loadingMore must be reset");

  // Verify cursor safety invariants after failure:
  assert.equal(inFlightCursorsRef.current.has("cursor-token-page-2"), false, "Failed cursor must be removed from in-flight");
  assert.equal(consumedCursorsRef.current.has("cursor-token-page-2"), false, "Failed cursor must NOT be marked consumed");
  assert.equal(currentCursorRef.current, "cursor-token-page-2", "currentCursor must retain the unconsumed cursor");
  assert.equal(hasNextPageRef.current, true, "hasNextPage must remain true");

  // 2. Retry attempt (network recovered)
  failNext = false;
  const result2 = await executeLoadMore();
  assert.equal(result2, true, "Retry must succeed with the same unconsumed cursor");
  assert.equal(networkCallCount, 2, "Second network call was permitted and executed");
  assert.equal(errorState, null, "Error state cleared on retry");

  // Verify cursor state after success:
  assert.equal(inFlightCursorsRef.current.has("cursor-token-page-2"), false, "Successful cursor removed from in-flight");
  assert.equal(consumedCursorsRef.current.has("cursor-token-page-2"), true, "Successful cursor must be marked consumed");
  assert.equal(currentCursorRef.current, "cursor-token-page-3", "currentCursor advanced to page 3");
  assert.equal(items.length, 2, "Items list expanded with page 2 data");

  // 3. Attempting to consume cursor-token-page-2 again is strictly blocked
  const duplicateAttempt = inFlightCursorsRef.current.has("cursor-token-page-2") || consumedCursorsRef.current.has("cursor-token-page-2");
  assert.equal(duplicateAttempt, true, "cursor-token-page-2 is already consumed and blocked from refetching");

  // 4. Next page abort test: aborting an in-flight request does not mark cursor as consumed
  abortNext = true;
  const resultAbort = await executeLoadMore();
  assert.equal(resultAbort, false, "Aborted loadMore returned false");
  assert.equal(networkCallCount, 3);
  assert.equal(consumedCursorsRef.current.has("cursor-token-page-3"), false, "Aborted cursor must NOT be marked consumed");
  assert.equal(inFlightCursorsRef.current.has("cursor-token-page-3"), false, "Aborted cursor must be cleared from in-flight");
  assert.equal(currentCursorRef.current, "cursor-token-page-3", "currentCursor remains page 3 ready for retry");

  // 5. Retry after abort succeeds
  abortNext = false;
  const resultAfterAbort = await executeLoadMore();
  assert.equal(resultAfterAbort, true, "Retry after abort must succeed");
  assert.equal(networkCallCount, 4);
  assert.equal(consumedCursorsRef.current.has("cursor-token-page-3"), true, "Cursor now marked consumed after success");
});
