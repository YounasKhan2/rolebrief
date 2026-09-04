import assert from "node:assert/strict";
import { test } from "node:test";
import { HimalayasIngestionService } from "./himalayas.ingestion.service";

test("disabled Himalayas ingestion performs no HTTP fetches and no writes", async () => {
  let fetched = false;
  let wrote = false;
  const service = new HimalayasIngestionService(
    { himalayas: { enabled: false } } as never,
    { ingestionRun: { create: async () => { wrote = true; } } } as never,
    {
      providerId: "himalayas",
      fetchPage: async () => {
        fetched = true;
        return { records: [], nextCursor: null, fetchedAt: new Date(), partialFailures: [] };
      }
    } as never
  );

  const result = await service.ingest();

  assert.equal(result.skipped, true);
  assert.equal(fetched, false);
  assert.equal(wrote, false);
});
