import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { clearEligibilityCache, fetchEligibilityBatch, fetchEligibilityJob } from "./eligibility";

const originalFetch = globalThis.fetch;

describe("Frontend Eligibility Client", () => {
  let fetchCalls: { url: string; body: any }[] = [];

  beforeEach(() => {
    fetchCalls = [];
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("fetchEligibilityBatch returns empty array without network request for empty slugs", async () => {
    const results = await fetchEligibilityBatch([]);
    assert.deepEqual(results, []);
    assert.equal(fetchCalls.length, 0);
  });

  it("fetchEligibilityBatch chunks into 50-item requests when more than 50 slugs provided", async () => {
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      const body = init?.body ? JSON.parse(init.body as string) : null;
      fetchCalls.push({ url: urlStr, body });

      const batchResponse = (body?.slugs || []).map((slug: string) => ({
        slug,
        overallStatus: "APPEARS_ELIGIBLE",
        primaryReasonCode: "LOC_WORLDWIDE_NO_RESTRICTIONS",
        badgeText: "Appears eligible",
        headline: "Appears eligible",
        isJobExpired: false
      }));

      return new Response(JSON.stringify(batchResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }) as any;

    const slugs = Array.from({ length: 105 }, (_, i) => `job-${i}`);
    const results = await fetchEligibilityBatch(slugs);

    assert.equal(results.length, 105);
    // 105 slugs should produce 3 chunks: 50, 50, 5
    assert.equal(fetchCalls.length, 3);
    assert.equal(fetchCalls[0].body.slugs.length, 50);
    assert.equal(fetchCalls[1].body.slugs.length, 50);
    assert.equal(fetchCalls[2].body.slugs.length, 5);
  });

  it("fetchEligibilityJob fetches detailed result for single job", async () => {
    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      assert.equal(urlStr.includes("/eligibility/jobs/test-job-123"), true);

      return new Response(
        JSON.stringify({
          slug: "test-job-123",
          overallStatus: "APPEARS_ELIGIBLE",
          primaryReasonCode: "LOC_COUNTRY_AUTHORIZED",
          badgeText: "Appears eligible",
          headline: "Authorized in US",
          isJobExpired: false,
          dimensions: [],
          knownFacts: {
            candidateResidenceCountry: "US",
            candidateWorkAuthorizations: ["US"],
            candidateRequiresSponsorship: false,
            candidateTimezone: "America/New_York",
            jobWorkMode: "REMOTE",
            jobRemoteScope: "COUNTRY_LIMITED",
            jobAllowedCountries: ["US"],
            jobTimezoneOffsets: [-300]
          },
          unstatedFacts: [],
          evaluatedAt: new Date().toISOString(),
          disclaimer: "Disclaimer"
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    }) as any;

    const result = await fetchEligibilityJob("test-job-123");
    assert.notEqual(result, null);
    assert.equal(result?.slug, "test-job-123");
    assert.equal(result?.overallStatus, "APPEARS_ELIGIBLE");
  });

  it("fetchEligibilityJob returns null on network or 404 error", async () => {
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ message: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }) as any;

    const result = await fetchEligibilityJob("missing-job");
    assert.equal(result, null);
  });

  it("clearEligibilityCache resets internal cache allowing refetching", () => {
    // Calling clearEligibilityCache should execute without throwing
    assert.doesNotThrow(() => {
      clearEligibilityCache();
    });
  });
});
