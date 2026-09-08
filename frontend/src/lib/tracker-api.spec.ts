import assert from "node:assert/strict";
import { test, afterEach } from "node:test";
import {
  createApplication,
  updateApplication,
  archiveApplication,
  restoreApplication
} from "./tracker-api";
import { serializeRequestBody, removeContentTypeHeader, hasContentTypeHeader } from "./request-body";
import { authRequest, setCachedCsrfToken } from "./auth-api";

const originalFetch = globalThis.fetch;
const originalFormData = globalThis.FormData;

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.FormData = originalFormData;
  setCachedCsrfToken(null);
});

test("serializeRequestBody: object serialization produces single valid JSON and sets Content-Type", () => {
  const payload = { jobSlug: "senior-staff-engineer", notes: "Applied via referral" };
  const { body, headers } = serializeRequestBody(payload);

  assert.equal(headers["Content-Type"], "application/json");
  assert.equal(typeof body, "string");
  assert.equal(body?.startsWith('"{"'), false);
  assert.deepEqual(JSON.parse(body as string), payload);
});

test("serializeRequestBody: raw strings are preserved without automatically adding Content-Type", () => {
  const rawString = "raw text payload";
  const { body, headers } = serializeRequestBody(rawString);

  assert.equal(body, rawString);
  // Must NOT automatically add Content-Type: application/json to arbitrary strings
  assert.equal(headers["Content-Type"], undefined);
  assert.equal(hasContentTypeHeader(headers), false);
});

test("serializeRequestBody: strings with caller-provided Content-Type preserve that header", () => {
  const rawString = JSON.stringify({ key: "value" });
  const { body, headers } = serializeRequestBody(rawString, { "Content-Type": "application/json" });

  assert.equal(headers["Content-Type"], "application/json");
  assert.equal(body, rawString);
});

test("serializeRequestBody: arrays are serialized to JSON with Content-Type: application/json", () => {
  const arr = [{ id: 1 }, { id: 2 }];
  const { body, headers } = serializeRequestBody(arr);

  assert.equal(headers["Content-Type"], "application/json");
  assert.equal(typeof body, "string");
  assert.deepEqual(JSON.parse(body as string), arr);
});

test("serializeRequestBody: URLSearchParams preserved as BodyInit and not JSON-stringified", () => {
  const params = new URLSearchParams({ query: "engineer", page: "2" });
  const { body, headers } = serializeRequestBody(params);

  assert.equal(body, params);
  assert.equal(headers["Content-Type"], undefined);
});

test("serializeRequestBody: Blob preserved as BodyInit and not JSON-stringified", () => {
  const blob = new Blob(["test-content"], { type: "text/plain" });
  const { body, headers } = serializeRequestBody(blob);

  assert.equal(body, blob);
  assert.equal(headers["Content-Type"], undefined);
});

test("serializeRequestBody: ArrayBuffer and Uint8Array preserved as BodyInit", () => {
  const buffer = new ArrayBuffer(8);
  const { body: bufferBody } = serializeRequestBody(buffer);
  assert.equal(bufferBody, buffer);

  const uint8 = new Uint8Array([1, 2, 3]);
  const { body: viewBody } = serializeRequestBody(uint8);
  assert.equal(viewBody, uint8);
});

test("serializeRequestBody: case-insensitive header checking does not duplicate Content-Type", () => {
  // If caller already passed lowercase "content-type", do not append "Content-Type"
  const existingHeaders = { "content-type": "application/problem+json", "X-Custom": "1" };
  const { headers } = serializeRequestBody({ test: true }, existingHeaders);

  assert.equal(headers["content-type"], "application/problem+json");
  assert.equal(headers["Content-Type"], undefined);
  assert.equal(Object.keys(headers).filter(k => k.toLowerCase() === "content-type").length, 1);
});

test("serializeRequestBody: FormData strips any existing casing of Content-Type to preserve boundary", () => {
  const formData = new FormData();
  formData.append("file", "test");
  const { body, headers } = serializeRequestBody(formData, {
    "content-type": "multipart/form-data",
    "Content-Type": "application/json",
    Authorization: "Bearer token"
  });

  assert.equal(body, formData);
  assert.equal(headers["Content-Type"], undefined);
  assert.equal(headers["content-type"], undefined);
  assert.equal(hasContentTypeHeader(headers), false);
  assert.equal(headers.Authorization, "Bearer token");
});

test("serializeRequestBody: null or undefined body sets undefined and does not set Content-Type", () => {
  const nullResult = serializeRequestBody(null);
  assert.equal(nullResult.body, undefined);
  assert.equal(nullResult.headers["Content-Type"], undefined);

  const undefinedResult = serializeRequestBody(undefined);
  assert.equal(undefinedResult.body, undefined);
  assert.equal(undefinedResult.headers["Content-Type"], undefined);
});

test("serializeRequestBody: safely handles environments where browser globals like FormData are unavailable", () => {
  // Simulate SSR / worker / Node without FormData
  (globalThis as any).FormData = undefined;

  const payload = { item: "ok" };
  const { body, headers } = serializeRequestBody(payload);

  assert.equal(headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(body as string), payload);
});

test("authRequest: serializes body again correctly on retry after 401 token refresh", async () => {
  const capturedRequests: Array<{ url: string; method: string; body: any; headers: Record<string, string> }> = [];

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = url.toString();
    const method = init?.method || "GET";
    const headers = (init?.headers || {}) as Record<string, string>;
    const body = init?.body;
    capturedRequests.push({ url: urlStr, method, body, headers });

    if (urlStr.includes("/auth/refresh")) {
      return new Response(
        JSON.stringify({
          user: { id: "u1", email: "user1@rolebrief.dev", role: "USER", status: "ACTIVE", isAdmin: false }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (urlStr.includes("/tracker") && capturedRequests.length === 1) {
      // First call fails with 401
      return new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Subsequent retry succeeds
    return new Response(
      JSON.stringify({ id: "app_retried", jobSlug: "test-slug", status: "SAVED", revision: 0 }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  }) as any;

  setCachedCsrfToken("csrf-refresh-test");

  const result = await authRequest<any>("/tracker", {
    method: "POST",
    csrf: true,
    body: { jobSlug: "test-slug" }
  });

  assert.equal(result.id, "app_retried");
  // Total 3 requests: initial POST /tracker (401), POST /auth/refresh (200), retry POST /tracker (201)
  assert.equal(capturedRequests.length, 3);
  assert.match(capturedRequests[0].url, /\/tracker$/);
  assert.match(capturedRequests[1].url, /\/auth\/refresh$/);
  assert.match(capturedRequests[2].url, /\/tracker$/);

  // Both initial request and retried request must have properly serialized body and Content-Type
  for (const reqIdx of [0, 2]) {
    const req = capturedRequests[reqIdx];
    assert.equal(req.method, "POST");
    assert.equal(req.headers["Content-Type"], "application/json");
    assert.equal(typeof req.body, "string");
    assert.equal(req.body.startsWith('"{\\"'), false);
    assert.deepEqual(JSON.parse(req.body), { jobSlug: "test-slug" });
  }
});

test("createApplication: sends POST /tracker with single-stringified JSON body", async () => {
  let capturedUrl = "";
  let capturedMethod = "";
  let capturedHeaders: Record<string, string> = {};
  let capturedBody: any = null;

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    capturedUrl = url.toString();
    capturedMethod = init?.method || "GET";
    capturedHeaders = (init?.headers || {}) as Record<string, string>;
    capturedBody = init?.body;

    return new Response(
      JSON.stringify({
        id: "app_1",
        userId: "user_1",
        jobSlug: "backend-lead",
        status: "SAVED",
        revision: 0,
        createdAt: "2026-09-08T00:00:00.000Z",
        updatedAt: "2026-09-08T00:00:00.000Z"
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" }
      }
    );
  }) as any;

  setCachedCsrfToken("csrf-test-token");

  const app = await createApplication({ jobSlug: "backend-lead" });

  assert.equal(capturedMethod, "POST");
  assert.match(capturedUrl, /\/tracker$/);
  assert.equal(capturedHeaders["Content-Type"], "application/json");
  assert.equal(capturedHeaders["x-rolebrief-csrf"], "csrf-test-token");

  assert.equal(typeof capturedBody, "string");
  assert.equal(capturedBody.startsWith('"{\\"'), false);
  const parsed = JSON.parse(capturedBody);
  assert.deepEqual(parsed, { jobSlug: "backend-lead" });
  assert.equal(app.id, "app_1");
  assert.equal(app.jobSlug, "backend-lead");
});

test("updateApplication: sends PATCH /tracker/:id with single-stringified JSON body", async () => {
  let capturedUrl = "";
  let capturedMethod = "";
  let capturedHeaders: Record<string, string> = {};
  let capturedBody: any = null;

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    capturedUrl = url.toString();
    capturedMethod = init?.method || "GET";
    capturedHeaders = (init?.headers || {}) as Record<string, string>;
    capturedBody = init?.body;

    return new Response(
      JSON.stringify({
        id: "app_1",
        userId: "user_1",
        jobSlug: "backend-lead",
        stage: "APPLIED",
        revision: 1,
        createdAt: "2026-09-08T00:00:00.000Z",
        updatedAt: "2026-09-08T00:00:00.000Z"
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  }) as any;

  setCachedCsrfToken("csrf-test-token");

  const app = await updateApplication("app_1", { stage: "APPLIED", expectedRevision: 0 });

  assert.equal(capturedMethod, "PATCH");
  assert.match(capturedUrl, /\/tracker\/app_1$/);
  assert.equal(capturedHeaders["Content-Type"], "application/json");
  assert.equal(capturedHeaders["x-rolebrief-csrf"], "csrf-test-token");

  assert.equal(typeof capturedBody, "string");
  assert.equal(capturedBody.startsWith('"{\\"'), false);
  const parsed = JSON.parse(capturedBody);
  assert.deepEqual(parsed, { stage: "APPLIED", expectedRevision: 0 });
  assert.equal(app.stage, "APPLIED");
  assert.equal(app.revision, 1);
});

test("archiveApplication: sends PATCH /tracker/:id/archive with expectedRevision and CSRF", async () => {
  let capturedUrl = "";
  let capturedMethod = "";
  let capturedHeaders: Record<string, string> = {};

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    capturedUrl = url.toString();
    capturedMethod = init?.method || "GET";
    capturedHeaders = (init?.headers || {}) as Record<string, string>;

    return new Response(
      JSON.stringify({
        id: "app_1",
        roleTitle: "Software Engineer",
        lifecycle: "ARCHIVED",
        revision: 2
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  }) as any;

  setCachedCsrfToken("csrf-archive-token");

  const app = await archiveApplication("app_1", 1);

  assert.equal(capturedMethod, "PATCH");
  assert.match(capturedUrl, /\/tracker\/app_1\/archive\?expectedRevision=1$/);
  assert.equal(capturedHeaders["x-rolebrief-csrf"], "csrf-archive-token");
  assert.equal(app.lifecycle, "ARCHIVED");
  assert.equal(app.revision, 2);
});

test("restoreApplication: sends PATCH /tracker/:id/restore with expectedRevision and CSRF", async () => {
  let capturedUrl = "";
  let capturedMethod = "";
  let capturedHeaders: Record<string, string> = {};

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    capturedUrl = url.toString();
    capturedMethod = init?.method || "GET";
    capturedHeaders = (init?.headers || {}) as Record<string, string>;

    return new Response(
      JSON.stringify({
        id: "app_1",
        roleTitle: "Software Engineer",
        lifecycle: "ACTIVE",
        revision: 3
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  }) as any;

  setCachedCsrfToken("csrf-restore-token");

  const app = await restoreApplication("app_1", 2);

  assert.equal(capturedMethod, "PATCH");
  assert.match(capturedUrl, /\/tracker\/app_1\/restore\?expectedRevision=2$/);
  assert.equal(capturedHeaders["x-rolebrief-csrf"], "csrf-restore-token");
  assert.equal(app.lifecycle, "ACTIVE");
  assert.equal(app.revision, 3);
});
