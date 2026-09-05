import assert from "node:assert/strict";
import { test } from "node:test";
import { HimalayasIngestionService } from "./himalayas.ingestion.service";
import { sampleHimalayasJob } from "./himalayas.test-fixtures";

test("disabled Himalayas ingestion performs no HTTP fetches and no writes", async () => {
  let fetched = false;
  let wrote = false;
  const service = new HimalayasIngestionService(
    { himalayas: { enabled: false } } as never,
    { ingestionRun: { create: async () => { wrote = true; } } } as never,
    {
      providerId: "himalayas.guid",
      fetchPage: async () => {
        fetched = true;
        return { records: [], nextCursor: null, fetchedAt: new Date(), partialFailures: [], terminal: true };
      }
    } as never
  );

  const result = await service.ingest();

  assert.equal(result.skipped, true);
  assert.equal(fetched, false);
  assert.equal(wrote, false);
});

test("initial backfill records multiple-page ingestion metrics", async () => {
  const prisma = createMockPrisma();
  const service = new HimalayasIngestionService(
    config({ initialBackfillPages: 2 }),
    prisma as never,
    {
      providerId: "himalayas.guid",
      fetchPage: async (cursor: string | null) => {
        if (cursor === null) return page([sampleHimalayasJob({ guid: "guid-1", title: "First role" })], "opaque-next");
        return page([sampleHimalayasJob({ guid: "guid-2", title: "Second role" })], null);
      }
    } as never
  );

  const result = await service.ingest({ mode: "initial-backfill" });

  assert.equal(result.pagesFetched, 2);
  assert.equal(result.fetched, 2);
  assert.equal(result.created, 2);
  assert.equal(result.updated, 0);
  assert.equal(result.unchanged, 0);
  assert.equal(result.terminalCursor, null);
  assert.equal(result.stopReason, "terminal_cursor");
  assert.equal(prisma.runs[0].recordsCreated, 2);
});

test("recurring sync stops after repeated unchanged provider records", async () => {
  const prisma = createMockPrisma();
  await seedExistingRecord(prisma, "guid-1", "Same role");

  const service = new HimalayasIngestionService(
    config({ recurringSyncPages: 5, unchangedStopThreshold: 1 }),
    prisma as never,
    {
      providerId: "himalayas.guid",
      fetchPage: async () => page([sampleHimalayasJob({ guid: "guid-1", title: "Same role" })], "opaque-next")
    } as never
  );

  const result = await service.ingest({ mode: "recurring-sync" });

  assert.equal(result.pagesFetched, 1);
  assert.equal(result.created, 0);
  assert.equal(result.updated, 0);
  assert.equal(result.unchanged, 1);
  assert.equal(result.terminalCursor, "opaque-next");
  assert.equal(result.stopReason, "unchanged_threshold");
});

test("partial provider runs persist failure metadata", async () => {
  const prisma = createMockPrisma();
  const service = new HimalayasIngestionService(
    config({ recurringSyncPages: 1 }),
    prisma as never,
    {
      providerId: "himalayas.guid",
      fetchPage: async () => ({
        records: [],
        nextCursor: null,
        fetchedAt: new Date(),
        partialFailures: [{ cursor: null, status: 503, message: "temporary", retryable: true }],
        terminal: true
      })
    } as never
  );

  const result = await service.ingest({ mode: "recurring-sync" });

  assert.equal(result.pagesFetched, 1);
  assert.equal(result.stopReason, "provider_error");
  assert.equal(result.failures.length, 1);
  assert.equal(prisma.runs[0].status, "partial");
});

function config(overrides: Record<string, number> = {}) {
  return {
    himalayas: {
      enabled: true,
      initialBackfillPages: 5,
      recurringSyncPages: 2,
      unchangedStopThreshold: 20,
      ...overrides
    }
  } as never;
}

function page(records: ReturnType<typeof sampleHimalayasJob>[], nextCursor: string | null) {
  return {
    records,
    nextCursor,
    fetchedAt: new Date(),
    partialFailures: [],
    terminal: nextCursor === null
  };
}

function createMockPrisma() {
  const state = {
    runId: "run-1",
    source: null as any,
    companies: new Map<string, any>(),
    jobs: new Map<string, any>(),
    providerRecords: new Map<string, any>(),
    locations: new Map<string, any>(),
    salaries: [] as any[],
    jobLocations: [] as any[],
    runs: [] as any[]
  };

  return {
    ...state,
    ingestionRun: {
      create: async ({ data }: any) => {
        const run = { id: `run-${state.runs.length + 1}`, ...data };
        state.runs.push(run);
        return run;
      },
      update: async ({ data }: any) => {
        Object.assign(state.runs[state.runs.length - 1], data);
        return state.runs[state.runs.length - 1];
      }
    },
    source: {
      upsert: async ({ create, update }: any) => {
        state.source = { id: "source-1", ...(state.source ?? create), ...update };
        return state.source;
      }
    },
    company: {
      upsert: async ({ where, create, update }: any) => {
        const existing = state.companies.get(where.slug);
        const company = { id: existing?.id ?? `company-${state.companies.size + 1}`, ...(existing ?? create), ...update };
        state.companies.set(where.slug, company);
        return company;
      }
    },
    job: {
      upsert: async ({ where, create, update }: any) => {
        const existing = state.jobs.get(where.slug);
        const job = { id: existing?.id ?? `job-${state.jobs.size + 1}`, slug: where.slug, ...(existing ? update : create) };
        state.jobs.set(where.slug, job);
        return job;
      }
    },
    providerRecord: {
      findUnique: async ({ where }: any) => state.providerRecords.get(recordKey(where.providerId_externalId_recordType)) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const key = recordKey(where.providerId_externalId_recordType);
        const existing = state.providerRecords.get(key);
        const record = { id: existing?.id ?? `record-${state.providerRecords.size + 1}`, ...(existing ? update : create) };
        state.providerRecords.set(key, record);
        return record;
      }
    },
    salary: {
      deleteMany: async ({ where }: any) => {
        state.salaries = state.salaries.filter((salary) => !(salary.jobId === where.jobId && salary.source === where.source));
      },
      create: async ({ data }: any) => {
        state.salaries.push(data);
        return data;
      }
    },
    jobLocation: {
      deleteMany: async ({ where }: any) => {
        state.jobLocations = state.jobLocations.filter((location) => location.jobId !== where.jobId);
      },
      create: async ({ data }: any) => {
        state.jobLocations.push(data);
        return data;
      }
    },
    location: {
      upsert: async ({ where, create, update }: any) => {
        const existing = state.locations.get(where.slug);
        const location = { id: existing?.id ?? `location-${state.locations.size + 1}`, ...(existing ?? create), ...update };
        state.locations.set(where.slug, location);
        return location;
      }
    }
  };
}

async function seedExistingRecord(prisma: ReturnType<typeof createMockPrisma>, guid: string, title: string) {
  const service = new HimalayasIngestionService(
    config({ initialBackfillPages: 1 }),
    prisma as never,
    {
      providerId: "himalayas.guid",
      fetchPage: async () => page([sampleHimalayasJob({ guid, title })], null)
    } as never
  );

  await service.ingest({ mode: "initial-backfill" });
}

function recordKey(input: { providerId: string; externalId: string; recordType: string }) {
  return `${input.providerId}:${input.externalId}:${input.recordType}`;
}
