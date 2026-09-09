import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { clearMatchBriefCache, fetchMatchBriefBatch } from "./match-briefs";
import { setCachedCsrfToken } from "./auth-api";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  setCachedCsrfToken(null);
  clearMatchBriefCache();
});

function summary(slug: string) {
  return {
    engineVersion: "match-brief-v1",
    taxonomyVersion: "title-taxonomy-v1",
    jobSlug: slug,
    status: "STRONG_ALIGNMENT",
    label: "Strong alignment",
    scorePercent: null,
    coveragePercent: 100,
    comparableDimensionCount: 5,
    primaryReasonCode: "TITLE_EXACT_MATCH",
    strengths: [],
    gaps: [],
    unknowns: [],
    profileRevision: 1,
    jobMatchVersion: "abc",
    calculatedAt: new Date().toISOString()
  };
}

test("fetchMatchBriefBatch returns empty results without a network request for empty slugs", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response("[]");
  }) as typeof fetch;

  const result = await fetchMatchBriefBatch([]);
  assert.deepEqual(result, []);
  assert.equal(calls, 0);
});

test("fetchMatchBriefBatch chunks requests at 50 slugs and sends CSRF with credentials", async () => {
  setCachedCsrfToken("csrf-match-test");
  const requests: { url: string; body: any; headers: Record<string, string>; credentials?: RequestCredentials }[] = [];
  globalThis.fetch = (async (input, init) => {
    const body = JSON.parse(String(init?.body));
    requests.push({
      url: String(input),
      body,
      headers: init?.headers as Record<string, string>,
      credentials: init?.credentials
    });
    return new Response(JSON.stringify(body.slugs.map(summary)), { status: 200 });
  }) as typeof fetch;

  const slugs = Array.from({ length: 51 }, (_, index) => `job-${index}`);
  const result = await fetchMatchBriefBatch(slugs);
  assert.equal(result.length, 51);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].body.slugs.length, 50);
  assert.equal(requests[1].body.slugs.length, 1);
  assert.equal(requests[0].headers["x-rolebrief-csrf"], "csrf-match-test");
  assert.equal(requests[0].credentials, "include");
});

test("fetchMatchBriefBatch deduplicates identical in-flight requests", async () => {
  setCachedCsrfToken("csrf-match-test");
  let calls = 0;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });

  globalThis.fetch = (async (input, init) => {
    calls += 1;
    await pending;
    const body = JSON.parse(String(init?.body));
    return new Response(JSON.stringify(body.slugs.map(summary)), { status: 200 });
  }) as typeof fetch;

  const first = fetchMatchBriefBatch(["same-job"]);
  const second = fetchMatchBriefBatch(["same-job"]);
  release();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(calls, 1);
  assert.equal(a[0].jobSlug, "same-job");
  assert.equal(b[0].jobSlug, "same-job");
});

