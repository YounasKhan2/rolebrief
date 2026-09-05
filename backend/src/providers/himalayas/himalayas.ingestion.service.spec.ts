import assert from "node:assert/strict";
import { test } from "node:test";
import { IngestionOrchestratorService } from "../ingestion-orchestrator.service";
import { JobProviderAdapter } from "../provider-adapter";
import { HimalayasIngestionService } from "./himalayas.ingestion.service";
import { sampleHimalayasJob } from "./himalayas.test-fixtures";

test("disabled Himalayas ingestion performs no HTTP fetches and no writes", async () => {
  let fetched = false;
  let wrote = false;
  const adapter = createAdapter({
    enabled: false,
    fetchPage: async () => {
      fetched = true;
      return page([]);
    }
  });
  const orchestrator = new IngestionOrchestratorService(
    { ingestionRun: { create: async () => { wrote = true; } } } as never,
    { persist: async () => "created" } as never
  );

  const result = await new HimalayasIngestionService(adapter as never, orchestrator).ingest();

  assert.equal(result.skipped, true);
  assert.equal(fetched, false);
  assert.equal(wrote, false);
});

test("initial backfill records multiple-page ingestion metrics and checkpoints", async () => {
  const prisma = createMockPrisma();
  const adapter = createAdapter({
    pageLimit: 2,
    fetchPage: async ({ cursor }) =>
      cursor === null
        ? page([sampleHimalayasJob({ guid: "guid-1", title: "First role" })], "opaque-next")
        : page([sampleHimalayasJob({ guid: "guid-2", title: "Second role" })], null)
  });

  const result = await serviceFor(adapter, prisma).ingest({ mode: "initial-backfill" });

  assert.equal(result.pagesFetched, 2);
  assert.equal(result.pagesCompleted, 2);
  assert.equal(result.fetched, 2);
  assert.equal(result.created, 2);
  assert.equal(result.terminalCursor, null);
  assert.equal(result.stopReason, "terminal_cursor");
  assert.equal(prisma.runs[0].recordsCreated, 2);
  assert.equal(prisma.checkpoints.get("himalayas.guid:backfill")?.cursor, null);
});

test("interrupted backfill resumes from the persisted cursor", async () => {
  const prisma = createMockPrisma();
  prisma.checkpoints.set("himalayas.guid:backfill", { providerId: "himalayas.guid", mode: "backfill", cursor: "resume-cursor" });
  let seenCursor: string | null = null;
  const adapter = createAdapter({
    pageLimit: 1,
    fetchPage: async ({ cursor }) => {
      seenCursor = cursor;
      return page([sampleHimalayasJob({ guid: "guid-resumed" })], null);
    }
  });

  await serviceFor(adapter, prisma).ingest({ mode: "backfill" });

  assert.equal(seenCursor, "resume-cursor");
});

test("recurring sync stops after repeated unchanged provider records", async () => {
  const prisma = createMockPrisma();
  const adapter = createAdapter({
    pageLimit: 5,
    stopThreshold: 1,
    fetchPage: async () => page([sampleHimalayasJob({ guid: "guid-1", title: "Same role" })], "opaque-next")
  });
  const orchestrator = new IngestionOrchestratorService(prisma as never, { persist: async () => "unchanged" } as never);

  const result = await new HimalayasIngestionService(adapter as never, orchestrator).ingest({ mode: "recurring-sync" });

  assert.equal(result.pagesFetched, 1);
  assert.equal(result.created, 0);
  assert.equal(result.unchanged, 1);
  assert.equal(result.terminalCursor, "opaque-next");
  assert.equal(result.stopReason, "unchanged_threshold");
});

test("partial provider runs persist failure metadata", async () => {
  const prisma = createMockPrisma();
  const adapter = createAdapter({
    pageLimit: 1,
    fetchPage: async () => ({
      records: [],
      nextCursor: null,
      fetchedAt: new Date(),
      partialFailures: [{ cursor: null, status: 503, message: "temporary", retryable: true }],
      terminal: true
    })
  });

  const result = await serviceFor(adapter, prisma).ingest({ mode: "recurring-sync" });

  assert.equal(result.pagesFetched, 1);
  assert.equal(result.stopReason, "provider_error");
  assert.equal(result.failures.length, 1);
  assert.equal(prisma.runs[0].status, "partial");
});

function serviceFor(adapter: JobProviderAdapter, prisma: ReturnType<typeof createMockPrisma>) {
  const orchestrator = new IngestionOrchestratorService(prisma as never, { persist: async () => "created" } as never);
  return new HimalayasIngestionService(adapter as never, orchestrator);
}

function createAdapter(overrides: Partial<JobProviderAdapter> & { enabled?: boolean; pageLimit?: number; stopThreshold?: number }): JobProviderAdapter {
  return {
    key: "himalayas.guid",
    capabilities: {
      pagination: "cursor",
      maxPageSize: 20,
      hasExpiry: true,
      hasApplicationDeadline: false,
      hasSalary: true,
      hasCountryRestrictions: true,
      hasTimezoneRestrictions: true,
      descriptionFormat: "html",
      search: "filter",
      refreshInterval: "24h",
      attribution: "Display visible Himalayas attribution."
    },
    isEnabled: () => overrides.enabled ?? true,
    pageLimitFor: () => overrides.pageLimit ?? 1,
    requestDelayMs: () => 0,
    unchangedStopThreshold: () => overrides.stopThreshold ?? 20,
    validateRecord: (input) => ({ ok: true, record: input as never }),
    normalize: (record) => ({
      externalId: (record as ReturnType<typeof sampleHimalayasJob>).guid,
      slug: `job-${(record as ReturnType<typeof sampleHimalayasJob>).guid}`,
      title: (record as ReturnType<typeof sampleHimalayasJob>).title,
      companySlug: "company",
      companyName: "Company",
      companyLogo: null,
      descriptionHtml: "<p>Role</p>",
      descriptionText: "Role",
      employmentType: "Full Time",
      seniority: "Senior",
      workMode: "REMOTE",
      remote: { scope: "WORLDWIDE", countries: [], countryCodes: [], labels: [], timezones: [] },
      sourcePublishedAt: null,
      sourceUpdatedAt: null,
      providerExpiresAt: null,
      applicationDeadlineAt: null,
      applicationUrl: "https://himalayas.app/jobs/example",
      sourceUrl: "https://himalayas.app/jobs/example",
      contentHash: "hash",
      canonicalFingerprint: "fingerprint",
      categories: [],
      parentCategories: [],
      salary: null,
      raw: record
    }),
    getExternalIdentity: (record) => (record as ReturnType<typeof sampleHimalayasJob>).guid,
    fetchPage: async () => page([]),
    ...overrides
  } as JobProviderAdapter;
}

function page(records: ReturnType<typeof sampleHimalayasJob>[], nextCursor: string | null = null) {
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
    runs: [] as any[],
    checkpoints: new Map<string, any>()
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
    ingestionCheckpoint: {
      findUnique: async ({ where }: any) => state.checkpoints.get(`${where.providerId_mode.providerId}:${where.providerId_mode.mode}`) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const key = `${where.providerId_mode.providerId}:${where.providerId_mode.mode}`;
        const checkpoint = { ...(state.checkpoints.get(key) ?? create), ...update };
        state.checkpoints.set(key, checkpoint);
        return checkpoint;
      }
    }
  };
}
