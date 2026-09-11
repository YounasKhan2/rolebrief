import assert from "node:assert/strict";
import { test, afterEach } from "node:test";
import {
  fetchSavedJobSlugs,
  fetchSavedJobs,
  saveJob,
  unsaveJob
} from "./saved-api";
import { setCachedCsrfToken } from "../auth/auth-api";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  setCachedCsrfToken(null);
});

test("fetchSavedJobSlugs: sends GET /saved/jobs/slugs and returns slugs array", async () => {
  let capturedUrl = "";
  let capturedMethod = "";

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    capturedUrl = url.toString();
    capturedMethod = init?.method || "GET";
    return new Response(JSON.stringify({ slugs: ["job-alpha", "job-beta"] }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }) as any;

  const slugs = await fetchSavedJobSlugs();
  assert.equal(capturedMethod, "GET");
  assert.match(capturedUrl, /\/saved\/jobs\/slugs$/);
  assert.deepEqual(slugs, ["job-alpha", "job-beta"]);
});

test("fetchSavedJobs: sends GET /saved/jobs with cursor query parameters and returns paginated response", async () => {
  let capturedUrl = "";
  let capturedMethod = "";

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    capturedUrl = url.toString();
    capturedMethod = init?.method || "GET";
    return new Response(
      JSON.stringify({
        data: [{ id: "j1", slug: "job-alpha", title: "Job Alpha" }],
        pageInfo: { nextCursor: "cur_next", hasNextPage: true },
        totalCount: 5
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  }) as any;

  const result = await fetchSavedJobs({ cursor: "cur_123", limit: 10 });
  assert.equal(capturedMethod, "GET");
  assert.match(capturedUrl, /\/saved\/jobs\?cursor=cur_123&limit=10$/);
  assert.equal(result.totalCount, 5);
  assert.equal(result.pageInfo?.hasNextPage, true);
  assert.equal(result.pageInfo?.nextCursor, "cur_next");
  assert.equal(result.data[0].slug, "job-alpha");
});

test("saveJob: sends POST /saved/jobs/:slug with CSRF token and credentials", async () => {
  let capturedUrl = "";
  let capturedMethod = "";
  let capturedHeaders: Record<string, string> = {};
  let capturedCredentials = "";

  setCachedCsrfToken("test-csrf-token-xyz");

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    capturedUrl = url.toString();
    capturedMethod = init?.method || "GET";
    capturedHeaders = (init?.headers as Record<string, string>) || {};
    capturedCredentials = init?.credentials || "";
    return new Response(
      JSON.stringify({ success: true, saved: true, slug: "test-slug" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  }) as any;

  const result = await saveJob("test-slug");
  assert.equal(capturedMethod, "POST");
  assert.match(capturedUrl, /\/saved\/jobs\/test-slug$/);
  assert.equal(capturedHeaders["x-rolebrief-csrf"], "test-csrf-token-xyz");
  assert.equal(capturedCredentials, "include");
  assert.deepEqual(result, { success: true, saved: true, slug: "test-slug" });
});

test("unsaveJob: sends DELETE /saved/jobs/:slug with CSRF token", async () => {
  let capturedUrl = "";
  let capturedMethod = "";
  let capturedHeaders: Record<string, string> = {};

  setCachedCsrfToken("test-csrf-token-abc");

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    capturedUrl = url.toString();
    capturedMethod = init?.method || "GET";
    capturedHeaders = (init?.headers as Record<string, string>) || {};
    return new Response(
      JSON.stringify({ success: true, saved: false, slug: "test-slug" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  }) as any;

  const result = await unsaveJob("test-slug");
  assert.equal(capturedMethod, "DELETE");
  assert.match(capturedUrl, /\/saved\/jobs\/test-slug$/);
  assert.equal(capturedHeaders["x-rolebrief-csrf"], "test-csrf-token-abc");
  assert.deepEqual(result, { success: true, saved: false, slug: "test-slug" });
});
