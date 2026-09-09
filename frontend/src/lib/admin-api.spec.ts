import assert from "node:assert/strict";
import { test, afterEach } from "node:test";
import {
  getAdminMetrics,
  getAdminSources,
  triggerSourceSync,
  getModerationQueue,
  executeModerationAction
} from "./admin-api";
import { setCachedCsrfToken } from "./auth-api";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  setCachedCsrfToken(null);
});

test("getAdminMetrics: fetches from /admin/metrics", async () => {
  let capturedUrl = "";
  globalThis.fetch = (async (url: any) => {
    capturedUrl = url.toString();
    return new Response(JSON.stringify({ users: { total: 50 } }), { status: 200 });
  }) as any;

  const data = await getAdminMetrics();
  assert.match(capturedUrl, /\/admin\/metrics$/);
  assert.equal(data.users.total, 50);
});

test("getAdminSources: fetches from /admin/sources", async () => {
  let capturedUrl = "";
  globalThis.fetch = (async (url: any) => {
    capturedUrl = url.toString();
    return new Response(JSON.stringify({ sources: [{ id: "himalayas", name: "Himalayas", status: "healthy" }] }), { status: 200 });
  }) as any;

  const data = await getAdminSources();
  assert.match(capturedUrl, /\/admin\/sources$/);
  assert.equal(data.sources[0].id, "himalayas");
});

test("triggerSourceSync: sends POST to /admin/sources/:providerId/sync with CSRF", async () => {
  setCachedCsrfToken("test-csrf-token");
  let capturedUrl = "";
  let capturedMethod = "";
  let capturedCsrf = "";

  globalThis.fetch = (async (url: any, init: any) => {
    capturedUrl = url.toString();
    capturedMethod = init?.method;
    capturedCsrf = init?.headers?.["x-rolebrief-csrf"];
    return new Response(JSON.stringify({ queued: true, jobId: "j-123", providerId: "himalayas" }), { status: 200 });
  }) as any;

  const res = await triggerSourceSync("himalayas");
  assert.equal(capturedMethod, "POST");
  assert.match(capturedUrl, /\/admin\/sources\/himalayas\/sync$/);
  assert.equal(capturedCsrf, "test-csrf-token");
  assert.equal(res.queued, true);
});

test("getModerationQueue: formats query parameters correctly", async () => {
  let capturedUrl = "";
  globalThis.fetch = (async (url: any) => {
    capturedUrl = url.toString();
    return new Response(JSON.stringify({ items: [], nextCursor: null, hasMore: false }), { status: 200 });
  }) as any;

  await getModerationQueue({ tab: "suspicious", cursor: "cur_1", limit: 10 });
  assert.match(capturedUrl, /\/admin\/moderation\/queue\?tab=suspicious&cursor=cur_1&limit=10$/);
});

test("executeModerationAction: sends action with CSRF", async () => {
  setCachedCsrfToken("mod-csrf");
  let capturedUrl = "";
  let capturedMethod = "";
  let capturedBody = "";

  globalThis.fetch = (async (url: any, init: any) => {
    capturedUrl = url.toString();
    capturedMethod = init?.method;
    capturedBody = init?.body;
    return new Response(JSON.stringify({ success: true, action: "APPROVE" }), { status: 200 });
  }) as any;

  const res = await executeModerationAction("job-123", "APPROVE", "verified");
  assert.equal(capturedMethod, "POST");
  assert.match(capturedUrl, /\/admin\/moderation\/job-123\/action$/);
  assert.equal(JSON.parse(capturedBody).action, "APPROVE");
  assert.equal(JSON.parse(capturedBody).notes, "verified");
  assert.equal(res.success, true);
});
