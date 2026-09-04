import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { HimalayasAdapter } from "./himalayas.adapter";

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
    return Response.json({
      nextCursor: "next-cursor",
      jobs: [
        {
          title: "Senior Engineer",
          companyName: "Acme",
          companySlug: "acme",
          locationRestrictions: [],
          timezoneRestrictions: [],
          categories: [],
          parentCategories: [],
          applicationLink: "https://himalayas.app/jobs/acme-senior-engineer",
          guid: "guid-1"
        }
      ]
    });
  }) as typeof fetch;

  const adapter = new HimalayasAdapter({
    himalayas: {
      apiUrl: "https://himalayas.app/jobs/api",
      pageLimit: 20,
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
});

test("live smoke fetches one controlled Himalayas page only when explicitly enabled", async (context) => {
  if (process.env.HIMALAYAS_LIVE_SMOKE !== "true") {
    context.skip("Set HIMALAYAS_LIVE_SMOKE=true to run the controlled live smoke test.");
    return;
  }

  const adapter = new HimalayasAdapter({
    himalayas: {
      apiUrl: process.env.HIMALAYAS_API_URL ?? "https://himalayas.app/jobs/api",
      pageLimit: 1,
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
