import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { HimalayasAdapter } from "./himalayas.adapter";
import { sampleHimalayasResponse } from "./himalayas.test-fixtures";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("fetchPage applies cursor pagination and retries rate limits", async () => {
  const urls: string[] = [];
  let calls = 0;
  globalThis.fetch = (async (input: string | URL | Request) => {
    calls += 1;
    urls.push(String(input));
    if (calls === 1) {
      return new Response("rate limited", { status: 429 });
    }
    return Response.json(sampleHimalayasResponse({
      nextCursor: "next-cursor",
    }));
  }) as typeof fetch;

  const adapter = new HimalayasAdapter({
    himalayas: {
      apiUrl: "https://himalayas.app/jobs/api",
      timeoutMs: 1000,
      retryAttempts: 1,
      retryDelayMs: 0,
      rateLimitDelayMs: 0
    }
  } as never);

  const page = await adapter.fetchPage("opaque");

  assert.equal(page.records.length, 1);
  assert.equal(page.nextCursor, "next-cursor");
  assert.equal(page.partialFailures.length, 1);
  assert.equal(new URL(urls[0]).searchParams.get("cursor"), "opaque");
  assert.equal(new URL(urls[0]).searchParams.get("limit"), "20");
  assert.equal(new URL(urls[1]).searchParams.get("cursor"), "opaque");
  assert.equal(new URL(urls[1]).searchParams.get("limit"), "20");
});

test("fetchPage honors Retry-After on 429", async () => {
  let delayed = 0;
  class TestAdapter extends HimalayasAdapter {
    protected override delay(ms: number) {
      delayed = ms;
      return Promise.resolve();
    }
  }

  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    if (calls === 1) {
      return new Response("rate limited", { status: 429, headers: { "retry-after": "2" } });
    }
    return Response.json(sampleHimalayasResponse());
  }) as typeof fetch;

  const adapter = new TestAdapter({
    himalayas: {
      apiUrl: "https://himalayas.app/jobs/api",
      timeoutMs: 1000,
      retryAttempts: 1,
      retryDelayMs: 0,
      rateLimitDelayMs: 0
    }
  } as never);

  await adapter.fetchPage(null);
  assert.equal(delayed, 2000);
});

test("live smoke fetches one controlled Himalayas page only when explicitly enabled", async (context) => {
  if (process.env.HIMALAYAS_LIVE_SMOKE !== "true") {
    context.skip("Set HIMALAYAS_LIVE_SMOKE=true to run the controlled live smoke test.");
    return;
  }

  const adapter = new HimalayasAdapter({
    himalayas: {
      apiUrl: process.env.HIMALAYAS_API_URL ?? "https://himalayas.app/jobs/api",
      timeoutMs: 5000,
      retryAttempts: 0,
      retryDelayMs: 0,
      rateLimitDelayMs: 0
    }
  } as never);

  const page = await adapter.fetchPage(null);
  assert.ok(page.records.length <= 1);
  assert.equal(page.partialFailures.length, 0);
});
