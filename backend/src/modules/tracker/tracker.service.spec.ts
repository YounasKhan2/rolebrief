import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { ApplicationLifecycle, ApplicationStage } from "@prisma/client";
import { TrackerService, ALLOWED_STAGE_TRANSITIONS } from "./tracker.service";
import { decodeTrackerCursor, encodeTrackerCursor } from "./tracker-cursor.util";

const TEST_SECRET = "test-secret-key-at-least-16-bytes-long";

function createMockPrisma(overrides: Record<string, any> = {}) {
  const store: Record<string, any[]> = {
    application: [],
    applicationHistory: [],
    job: []
  };

  return {
    application: {
      findMany: async () => [],
      findFirst: async () => null,
      findUnique: async () => null,
      findUniqueOrThrow: async () => ({}),
      count: async () => 0,
      groupBy: async () => [],
      create: async () => ({}),
      updateMany: async () => ({ count: 1 }),
      deleteMany: async () => ({ count: 1 }),
      ...overrides.application
    },
    applicationHistory: {
      create: async () => ({}),
      findMany: async () => [],
      ...overrides.applicationHistory
    },
    job: {
      findUnique: async () => null,
      ...overrides.job
    },
    $transaction: async (fn: any) => fn(overrides.txPrisma || {
      application: {
        create: async (args: any) => ({ id: "app_tx_1", ...args.data }),
        findUniqueOrThrow: async () => ({ id: "app_tx_1", revision: 0, stage: ApplicationStage.SAVED, createdAt: new Date(), updatedAt: new Date() }),
        updateMany: async () => ({ count: 1 }),
        ...overrides.application
      },
      applicationHistory: {
        create: async (args: any) => ({ id: "hist_tx_1", ...args.data }),
        ...overrides.applicationHistory
      }
    }),
    ...overrides
  } as any;
}

function createMockConfig() {
  return {
    cursorSigningSecret: TEST_SECRET
  } as any;
}

function createMockJobsService() {
  return {} as any;
}

// 1. Cursors
test("TrackerCursor: encodes and decodes valid signed cursor", () => {
  const payload = {
    v: 1 as const,
    userId: "user_123",
    stageFilter: "APPLIED",
    updatedAt: new Date().toISOString(),
    id: "app_abc"
  };

  const token = encodeTrackerCursor(payload, TEST_SECRET);
  assert.ok(token.includes("."), "Cursor token must have dot separator");

  const decoded = decodeTrackerCursor(token, TEST_SECRET, "user_123", "APPLIED");
  assert.equal(decoded.v, 1);
  assert.equal(decoded.userId, "user_123");
  assert.equal(decoded.stageFilter, "APPLIED");
  assert.equal(decoded.id, "app_abc");
  assert.equal(decoded.updatedAt, payload.updatedAt);
});

test("TrackerCursor: rejects tampered signature or payload", () => {
  const payload = {
    v: 1 as const,
    userId: "user_123",
    stageFilter: "APPLIED",
    updatedAt: new Date().toISOString(),
    id: "app_abc"
  };
  const token = encodeTrackerCursor(payload, TEST_SECRET);
  const [b64, sig] = token.split(".");

  // Tampered payload
  const tamperedPayload = Buffer.from(JSON.stringify({ ...payload, id: "hacked" })).toString("base64url");
  assert.throws(() => decodeTrackerCursor(`${tamperedPayload}.${sig}`, TEST_SECRET, "user_123", "APPLIED"), BadRequestException);

  // Tampered signature
  assert.throws(() => decodeTrackerCursor(`${b64}.tamperedSig`, TEST_SECRET, "user_123", "APPLIED"), BadRequestException);

  // Cross-user reuse
  assert.throws(() => decodeTrackerCursor(token, TEST_SECRET, "user_other", "APPLIED"), BadRequestException);

  // Cross-stageFilter reuse
  assert.throws(() => decodeTrackerCursor(token, TEST_SECRET, "user_123", "INTERVIEWING"), BadRequestException);
});

// 2. Transition State Machine
test("Transition Matrix: allows valid user transitions", () => {
  const service = new TrackerService(createMockPrisma(), createMockJobsService(), createMockConfig());

  // Same stage is always valid
  assert.equal(service.validateTransition(ApplicationStage.SAVED, ApplicationStage.SAVED), true);

  // SAVED -> APPLIED, WITHDRAWN
  assert.equal(service.validateTransition(ApplicationStage.SAVED, ApplicationStage.APPLIED), true);
  assert.equal(service.validateTransition(ApplicationStage.SAVED, ApplicationStage.WITHDRAWN), true);

  // APPLIED -> INTERVIEWING, REJECTED, WITHDRAWN, SAVED
  assert.equal(service.validateTransition(ApplicationStage.APPLIED, ApplicationStage.INTERVIEWING), true);
  assert.equal(service.validateTransition(ApplicationStage.APPLIED, ApplicationStage.REJECTED), true);
  assert.equal(service.validateTransition(ApplicationStage.APPLIED, ApplicationStage.WITHDRAWN), true);
  assert.equal(service.validateTransition(ApplicationStage.APPLIED, ApplicationStage.SAVED), true);

  // INTERVIEWING -> OFFER, REJECTED, WITHDRAWN, APPLIED
  assert.equal(service.validateTransition(ApplicationStage.INTERVIEWING, ApplicationStage.OFFER), true);
  assert.equal(service.validateTransition(ApplicationStage.INTERVIEWING, ApplicationStage.REJECTED), true);

  // OFFER -> INTERVIEWING, REJECTED, WITHDRAWN
  assert.equal(service.validateTransition(ApplicationStage.OFFER, ApplicationStage.INTERVIEWING), true);

  // REJECTED -> APPLIED, INTERVIEWING
  assert.equal(service.validateTransition(ApplicationStage.REJECTED, ApplicationStage.APPLIED), true);
  assert.equal(service.validateTransition(ApplicationStage.REJECTED, ApplicationStage.INTERVIEWING), true);

  // WITHDRAWN -> SAVED, APPLIED
  assert.equal(service.validateTransition(ApplicationStage.WITHDRAWN, ApplicationStage.SAVED), true);
  assert.equal(service.validateTransition(ApplicationStage.WITHDRAWN, ApplicationStage.APPLIED), true);
});

test("Transition Matrix: rejects invalid transitions", () => {
  const service = new TrackerService(createMockPrisma(), createMockJobsService(), createMockConfig());

  // SAVED -> OFFER (invalid jump)
  assert.equal(service.validateTransition(ApplicationStage.SAVED, ApplicationStage.OFFER), false);
  // SAVED -> INTERVIEWING (invalid jump)
  assert.equal(service.validateTransition(ApplicationStage.SAVED, ApplicationStage.INTERVIEWING), false);
  // SAVED -> REJECTED (invalid jump)
  assert.equal(service.validateTransition(ApplicationStage.SAVED, ApplicationStage.REJECTED), false);
  // REJECTED -> OFFER (invalid jump)
  assert.equal(service.validateTransition(ApplicationStage.REJECTED, ApplicationStage.OFFER), false);
  // WITHDRAWN -> OFFER (invalid jump)
  assert.equal(service.validateTransition(ApplicationStage.WITHDRAWN, ApplicationStage.OFFER), false);
});

// 3. Optimistic Concurrency
test("TrackerService.update: enforces optimistic concurrency with expectedRevision", async () => {
  const currentApp = {
    id: "app_1",
    userId: "user_1",
    stage: ApplicationStage.SAVED,
    revision: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
    history: []
  };

  const mockPrisma = createMockPrisma({
    application: {
      findFirst: async (args: any) => {
        if (args.where.id === "app_1" && args.where.userId === "user_1") {
          return currentApp;
        }
        return null;
      },
      updateMany: async (args: any) => {
        if (args.where.revision === currentApp.revision) {
          return { count: 1 };
        }
        return { count: 0 };
      },
      findUniqueOrThrow: async () => ({
        ...currentApp,
        revision: currentApp.revision + 1,
        stage: ApplicationStage.APPLIED
      })
    }
  });

  const service = new TrackerService(mockPrisma, createMockJobsService(), createMockConfig());

  // Valid revision update succeeds
  const updated = await service.update("user_1", "app_1", {
    expectedRevision: 2,
    stage: ApplicationStage.APPLIED
  });
  assert.equal(updated.revision, 3);
  assert.equal(updated.stage, ApplicationStage.APPLIED);

  // Stale revision update (client passed revision 1 instead of 2) throws ConflictException (409)
  await assert.rejects(
    async () => {
      await service.update("user_1", "app_1", {
        expectedRevision: 1,
        stage: ApplicationStage.APPLIED
      });
    },
    (err: any) => {
      assert.ok(err instanceof ConflictException);
      assert.equal((err.getResponse() as any).currentRevision, 2);
      return true;
    }
  );
});

// 4. Multi-user isolation
test("TrackerService: isolates users so User A cannot access User B's application", async () => {
  const mockPrisma = createMockPrisma({
    application: {
      findFirst: async (args: any) => {
        if (args.where.id === "app_secret" && args.where.userId === "user_owner") {
          return { id: "app_secret", userId: "user_owner", revision: 0, stage: ApplicationStage.SAVED, createdAt: new Date(), updatedAt: new Date() };
        }
        return null;
      }
    }
  });

  const service = new TrackerService(mockPrisma, createMockJobsService(), createMockConfig());

  // User B tries to get User A's app
  await assert.rejects(
    async () => service.getById("user_attacker", "app_secret"),
    NotFoundException
  );

  // User B tries to update User A's app
  await assert.rejects(
    async () => service.update("user_attacker", "app_secret", { expectedRevision: 0, notes: "hacked" }),
    NotFoundException
  );

  // User B tries to delete User A's app
  await assert.rejects(
    async () => service.delete("user_attacker", "app_secret", 0),
    NotFoundException
  );
});

// 5. Idempotent tracking
test("TrackerService.create: tracking the same job twice returns existing application", async () => {
  const existingApp = {
    id: "app_existing",
    userId: "user_1",
    jobId: "job_123",
    jobSlug: "staff-engineer",
    roleTitle: "Staff Engineer",
    stage: ApplicationStage.SAVED,
    revision: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    history: []
  };

  const mockPrisma = createMockPrisma({
    job: {
      findUnique: async () => ({
        id: "job_123",
        slug: "staff-engineer",
        canonicalTitle: "Staff Engineer",
        company: { canonicalName: "Acme Corp" },
        source: { name: "Himalayas" },
        locations: [],
        providerRecords: []
      })
    },
    application: {
      findUnique: async (args: any) => {
        if (args.where.userId_jobId) {
          return existingApp;
        }
        return null;
      }
    }
  });

  const service = new TrackerService(mockPrisma, createMockJobsService(), createMockConfig());

  const result = await service.create("user_1", { jobSlug: "staff-engineer" });
  assert.equal(result.id, "app_existing");
  assert.equal(result.alreadyTracked, true);
});

// 6. Relational history creation
test("TrackerService: appends relational history on creation and stage transition", async () => {
  const historyEvents: any[] = [];

  const mockPrisma = createMockPrisma({
    application: {
      findFirst: async () => ({
        id: "app_test",
        userId: "user_1",
        stage: ApplicationStage.SAVED,
        revision: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }),
      updateMany: async () => ({ count: 1 }),
      findUniqueOrThrow: async () => ({
        id: "app_test",
        userId: "user_1",
        stage: ApplicationStage.APPLIED,
        revision: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        history: historyEvents
      })
    },
    applicationHistory: {
      create: async (args: any) => {
        historyEvents.push(args.data);
        return { id: `hist_${historyEvents.length}`, ...args.data };
      }
    }
  });

  const service = new TrackerService(mockPrisma, createMockJobsService(), createMockConfig());

  // Initial creation
  await service.create("user_1", {
    roleTitle: "Senior Frontend Engineer",
    companyName: "Vercel",
    stage: ApplicationStage.SAVED
  });

  assert.equal(historyEvents.length, 1);
  assert.equal(historyEvents[0].fromStage, null);
  assert.equal(historyEvents[0].toStage, ApplicationStage.SAVED);

  // Transition to APPLIED
  await service.update("user_1", "app_test", {
    expectedRevision: 0,
    stage: ApplicationStage.APPLIED,
    stageChangeNote: "Submitted resume on career portal"
  });

  assert.equal(historyEvents.length, 2);
  assert.equal(historyEvents[1].fromStage, ApplicationStage.SAVED);
  assert.equal(historyEvents[1].toStage, ApplicationStage.APPLIED);
  assert.equal(historyEvents[1].note, "Submitted resume on career portal");
});

// 7. Expired job detection in serialization
test("TrackerService: serialize accurately flags isJobExpired for delisted/expired jobs", async () => {
  const pastDate = new Date(Date.now() - 86400000);
  const futureDate = new Date(Date.now() + 86400000);

  const mockPrisma = createMockPrisma({
    application: {
      findFirst: async (args: any) => {
        if (args.where.id === "app_expired") {
          return {
            id: "app_expired",
            userId: "user_1",
            roleTitle: "Staff Engineer",
            stage: ApplicationStage.SAVED,
            revision: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            job: {
              id: "job_old",
              slug: "staff-engineer-old",
              status: "ACTIVE",
              expiresAt: pastDate
            }
          };
        }
        return {
          id: "app_active",
          userId: "user_1",
          roleTitle: "Staff Engineer",
          stage: ApplicationStage.SAVED,
          revision: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          job: {
            id: "job_new",
            slug: "staff-engineer-new",
            status: "ACTIVE",
            expiresAt: futureDate
          }
        };
      }
    }
  });

  const service = new TrackerService(mockPrisma, createMockJobsService(), createMockConfig());

  const expiredApp = await service.getById("user_1", "app_expired");
  assert.equal(expiredApp.isJobExpired, true);

  const activeApp = await service.getById("user_1", "app_active");
  assert.equal(activeApp.isJobExpired, false);
});

// 8. Archived application re-tracking restores to ACTIVE
test("TrackerService: re-tracking an archived job restores it to ACTIVE with history entry", async () => {
  let updatedData: any = null;
  const historyCreated: any[] = [];

  const mockPrisma = createMockPrisma({
    job: {
      findUnique: async () => ({
        id: "job_archived_1",
        slug: "archived-role-slug",
        canonicalTitle: "Archived Role",
        company: { canonicalName: "Old Corp" },
        source: { name: "Himalayas" },
        locations: [],
        providerRecords: []
      })
    },
    application: {
      findUnique: async () => ({
        id: "app_archived_1",
        userId: "user_1",
        jobId: "job_archived_1",
        roleTitle: "Archived Role",
        stage: ApplicationStage.SAVED,
        lifecycle: ApplicationLifecycle.ARCHIVED,
        revision: 2,
        history: []
      })
    },
    txPrisma: {
      application: {
        update: async (args: any) => {
          updatedData = args.data;
          return {
            id: "app_archived_1",
            userId: "user_1",
            roleTitle: "Archived Role",
            stage: ApplicationStage.SAVED,
            lifecycle: ApplicationLifecycle.ACTIVE,
            revision: 3,
            history: []
          };
        }
      },
      applicationHistory: {
        create: async (args: any) => {
          historyCreated.push(args.data);
          return { id: "hist_restored_1", ...args.data };
        }
      }
    }
  });

  const service = new TrackerService(mockPrisma, createMockJobsService(), createMockConfig());
  const result = await service.create("user_1", { jobSlug: "archived-role-slug" });

  assert.equal(result.alreadyTracked, false);
  assert.equal(result.restored, true);
  assert.equal(updatedData.lifecycle, ApplicationLifecycle.ACTIVE);
  assert.equal(historyCreated.length, 1);
  assert.match(historyCreated[0].note, /Restored from archive/);
});

// 9. Signed cursor binds lifecycleFilter
test("TrackerCursor: encodes and validates lifecycleFilter", () => {
  const payload = {
    v: 1 as const,
    userId: "user_123",
    stageFilter: "SAVED",
    lifecycleFilter: "ARCHIVED",
    updatedAt: new Date().toISOString(),
    id: "app_arch_1"
  };

  const token = encodeTrackerCursor(payload, TEST_SECRET);
  const decoded = decodeTrackerCursor(token, TEST_SECRET, "user_123", "SAVED", "ARCHIVED");
  assert.equal(decoded.lifecycleFilter, "ARCHIVED");

  // Rejects when queried with mismatched lifecycle
  assert.throws(
    () => decodeTrackerCursor(token, TEST_SECRET, "user_123", "SAVED", "ACTIVE"),
    BadRequestException
  );
});

// 10. Provider job deletion safety: serializes gracefully when jobId/job is null
test("TrackerService: serialize handles orphaned application after provider job deletion", async () => {
  const mockPrisma = createMockPrisma({
    application: {
      findFirst: async () => ({
        id: "app_orphaned",
        userId: "user_1",
        jobId: null, // deleted by provider with onDelete: SetNull
        job: null,
        roleTitle: "Software Engineer",
        companyName: "Acme",
        stage: ApplicationStage.APPLIED,
        revision: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        history: []
      })
    }
  });

  const service = new TrackerService(mockPrisma, createMockJobsService(), createMockConfig());
  const app = await service.getById("user_1", "app_orphaned");

  assert.equal(app.id, "app_orphaned");
  assert.equal(app.jobId, null);
  assert.equal(app.companyLogoUrl, null);
  assert.equal(app.isJobExpired, false);
});

// 11. Archive and Restore methods
test("TrackerService: archive and restore update lifecycle and record history", async () => {
  let updatedData: any = null;
  const historyCreated: any[] = [];
  let currentLifecycle = ApplicationLifecycle.ACTIVE;

  const mockPrisma = createMockPrisma({
    application: {
      findFirst: async () => ({
        id: "app_lifecycle_test",
        userId: "user_1",
        roleTitle: "Staff Engineer",
        stage: ApplicationStage.SAVED,
        lifecycle: currentLifecycle,
        revision: 0
      }),
      findUniqueOrThrow: async () => ({
        id: "app_lifecycle_test",
        userId: "user_1",
        roleTitle: "Staff Engineer",
        stage: ApplicationStage.SAVED,
        lifecycle: currentLifecycle,
        revision: 1,
        history: []
      }),
      updateMany: async (args: any) => {
        if (args.data.lifecycle) currentLifecycle = args.data.lifecycle;
        updatedData = args.data;
        return { count: 1 };
      }
    },
    applicationHistory: {
      create: async (args: any) => {
        historyCreated.push(args.data);
        return { id: `hist_${historyCreated.length}`, ...args.data };
      }
    }
  });

  const service = new TrackerService(mockPrisma, createMockJobsService(), createMockConfig());

  // Archive
  await service.archive("user_1", "app_lifecycle_test", 0);
  assert.equal(updatedData.lifecycle, ApplicationLifecycle.ARCHIVED);
  assert.equal(historyCreated.length, 1);
  assert.equal(historyCreated[0].note, "Archived application");

  // Restore
  await service.restore("user_1", "app_lifecycle_test", 0);
  assert.equal(updatedData.lifecycle, ApplicationLifecycle.ACTIVE);
  assert.equal(historyCreated.length, 2);
  assert.equal(historyCreated[1].note, "Restored application to active");
});

// 12. Keyset pagination tuple boundary & tied timestamps
test("TrackerService: keyset tuple boundary generates correct query and traverses tied timestamps with zero drops/duplicates", async () => {
  let capturedFindManyArgs: any = null;

  // Create 6 records with tied updatedAt timestamps:
  // Item 1 & 2 share timestamp T1
  // Item 3 & 4 share timestamp T2
  // Item 5 & 6 share timestamp T3
  const t1 = new Date("2026-09-08T10:00:00.000Z");
  const t2 = new Date("2026-09-08T09:00:00.000Z");
  const t3 = new Date("2026-09-08T08:00:00.000Z");

  const records = [
    { id: "app_6", userId: "u1", updatedAt: t1, createdAt: t1, stage: ApplicationStage.SAVED, lifecycle: ApplicationLifecycle.ACTIVE, revision: 0, history: [] },
    { id: "app_5", userId: "u1", updatedAt: t1, createdAt: t1, stage: ApplicationStage.SAVED, lifecycle: ApplicationLifecycle.ACTIVE, revision: 0, history: [] },
    { id: "app_4", userId: "u1", updatedAt: t2, createdAt: t2, stage: ApplicationStage.SAVED, lifecycle: ApplicationLifecycle.ACTIVE, revision: 0, history: [] },
    { id: "app_3", userId: "u1", updatedAt: t2, createdAt: t2, stage: ApplicationStage.SAVED, lifecycle: ApplicationLifecycle.ACTIVE, revision: 0, history: [] },
    { id: "app_2", userId: "u1", updatedAt: t3, createdAt: t3, stage: ApplicationStage.SAVED, lifecycle: ApplicationLifecycle.ACTIVE, revision: 0, history: [] },
    { id: "app_1", userId: "u1", updatedAt: t3, createdAt: t3, stage: ApplicationStage.SAVED, lifecycle: ApplicationLifecycle.ACTIVE, revision: 0, history: [] }
  ];

  const mockPrisma = createMockPrisma({
    application: {
      count: async () => 6,
      groupBy: async () => [{ stage: ApplicationStage.SAVED, _count: { _all: 6 } }],
      findMany: async (args: any) => {
        capturedFindManyArgs = args;
        let filtered = [...records];
        if (args.where?.OR) {
          const [ltBranch, eqLtBranch] = args.where.OR;
          const cursorDate = ltBranch.updatedAt.lt;
          const cursorId = eqLtBranch.id.lt;
          filtered = filtered.filter((r) => {
            return (
              r.updatedAt.getTime() < cursorDate.getTime() ||
              (r.updatedAt.getTime() === cursorDate.getTime() && r.id < cursorId)
            );
          });
        }
        return filtered.slice(0, args.take);
      }
    }
  });

  const service = new TrackerService(mockPrisma, createMockJobsService(), createMockConfig());

  // Page 1: take 2
  const p1 = await service.list("u1", { limit: 2 });
  assert.equal(p1.data.length, 2);
  assert.equal(p1.data[0].id, "app_6");
  assert.equal(p1.data[1].id, "app_5");
  assert.equal(p1.pageInfo.hasNextPage, true);
  assert.ok(p1.pageInfo.nextCursor);

  // Page 2: pass cursor from Page 1
  const p2 = await service.list("u1", { limit: 2, cursor: p1.pageInfo.nextCursor! });
  assert.equal(p2.data.length, 2);
  assert.equal(p2.data[0].id, "app_4");
  assert.equal(p2.data[1].id, "app_3");
  assert.equal(p2.pageInfo.hasNextPage, true);

  // Verify tuple boundary in captured Prisma args:
  assert.ok(capturedFindManyArgs.where.OR, "Must have OR clause for tuple boundary");
  assert.equal(capturedFindManyArgs.where.OR.length, 2);
  assert.ok(capturedFindManyArgs.where.OR[0].updatedAt.lt);
  assert.equal(capturedFindManyArgs.where.OR[1].id.lt, "app_5");

  // Page 3: pass cursor from Page 2
  const p3 = await service.list("u1", { limit: 2, cursor: p2.pageInfo.nextCursor! });
  assert.equal(p3.data.length, 2);
  assert.equal(p3.data[0].id, "app_2");
  assert.equal(p3.data[1].id, "app_1");
  assert.equal(p3.pageInfo.hasNextPage, false);
  assert.equal(p3.pageInfo.nextCursor, null);

  // Assert 0 duplicates and 0 drops
  const allTraversedIds = [...p1.data, ...p2.data, ...p3.data].map((a) => a.id);
  assert.equal(allTraversedIds.length, 6);
  assert.deepEqual(allTraversedIds, ["app_6", "app_5", "app_4", "app_3", "app_2", "app_1"]);
  const uniqueIds = new Set(allTraversedIds);
  assert.equal(uniqueIds.size, 6, "Zero duplicates across pages with tied timestamps");
});

// 13. History immutability & zero phantom history events
test("TrackerService: history is append-only on valid stage change; no history created on metadata update or failed revision", async () => {
  const historyStore: any[] = [];
  let currentRevision = 1;

  const mockPrisma = createMockPrisma({
    application: {
      findFirst: async () => ({
        id: "app_immut",
        userId: "user_immut",
        stage: ApplicationStage.SAVED,
        lifecycle: ApplicationLifecycle.ACTIVE,
        revision: currentRevision,
        notes: "initial note",
        createdAt: new Date(),
        updatedAt: new Date()
      }),
      updateMany: async (args: any) => {
        if (args.where.revision === currentRevision) {
          currentRevision++;
          return { count: 1 };
        }
        return { count: 0 };
      },
      findUniqueOrThrow: async () => ({
        id: "app_immut",
        userId: "user_immut",
        stage: ApplicationStage.SAVED,
        lifecycle: ApplicationLifecycle.ACTIVE,
        revision: currentRevision,
        notes: "updated note",
        createdAt: new Date(),
        updatedAt: new Date(),
        history: historyStore
      })
    },
    applicationHistory: {
      create: async (args: any) => {
        historyStore.push(args.data);
        return { id: `hist_${historyStore.length}`, ...args.data };
      }
    }
  });

  const service = new TrackerService(mockPrisma, createMockJobsService(), createMockConfig());

  // A: Metadata update (notes changed, stage unchanged) => 0 history entries appended
  await service.update("user_immut", "app_immut", {
    expectedRevision: 1,
    notes: "updated note"
  });
  assert.equal(historyStore.length, 0, "No history entry created on metadata-only update");

  // B: Stale revision conflict => throws 409 and 0 history entries appended
  await assert.rejects(
    async () => {
      await service.update("user_immut", "app_immut", {
        expectedRevision: 1, // Stale! Current is 2
        stage: ApplicationStage.APPLIED
      });
    },
    ConflictException
  );
  assert.equal(historyStore.length, 0, "No history entry created on failed/stale revision");

  // C: Valid stage transition => appends exactly 1 history entry
  await service.update("user_immut", "app_immut", {
    expectedRevision: 2, // Current is 2
    stage: ApplicationStage.APPLIED,
    stageChangeNote: "Applied on career site"
  });
  assert.equal(historyStore.length, 1, "Exactly 1 history entry appended on valid stage transition");
  assert.equal(historyStore[0].fromStage, ApplicationStage.SAVED);
  assert.equal(historyStore[0].toStage, ApplicationStage.APPLIED);
  assert.equal(historyStore[0].note, "Applied on career site");
});

// 14. Employer deadline provenance: strictly from Job.applicationDeadlineAt
test("TrackerService: employerDeadlineAt comes strictly from Job.applicationDeadlineAt, not expiresAt", async () => {
  const jobWithDeadline = {
    id: "job_deadlined",
    slug: "deadline-role",
    canonicalTitle: "Role With Deadline",
    applicationDeadlineAt: new Date("2026-10-01T00:00:00Z"),
    expiresAt: new Date("2026-12-31T00:00:00Z"),
    company: { canonicalName: "TechCorp" },
    source: { name: "Himalayas" },
    locations: [],
    providerRecords: []
  };

  const jobWithoutDeadline = {
    id: "job_no_deadline",
    slug: "no-deadline-role",
    canonicalTitle: "Role Without Deadline",
    applicationDeadlineAt: null,
    expiresAt: new Date("2026-12-31T00:00:00Z"), // Has expiresAt, but NOT applicationDeadlineAt
    company: { canonicalName: "TechCorp" },
    source: { name: "Himalayas" },
    locations: [],
    providerRecords: []
  };

  let capturedCreatedApp: any = null;
  const mockPrisma = createMockPrisma({
    job: {
      findUnique: async (args: any) => {
        if (args.where.slug === "deadline-role") return jobWithDeadline;
        if (args.where.slug === "no-deadline-role") return jobWithoutDeadline;
        return null;
      }
    },
    application: {
      findUnique: async () => null,
      create: async (args: any) => {
        capturedCreatedApp = args.data;
        return { id: "app_new", ...args.data };
      },
      findUniqueOrThrow: async () => ({
        id: "app_new",
        ...capturedCreatedApp,
        createdAt: new Date(),
        updatedAt: new Date(),
        history: []
      })
    }
  });

  const service = new TrackerService(mockPrisma, createMockJobsService(), createMockConfig());

  // Test 1: With explicit applicationDeadlineAt
  const res1 = await service.create("u1", { jobSlug: "deadline-role" });
  assert.equal(res1.employerDeadlineAt, "2026-10-01T00:00:00.000Z");

  // Test 2: Without applicationDeadlineAt (even with expiresAt present)
  const res2 = await service.create("u1", { jobSlug: "no-deadline-role" });
  assert.equal(res2.employerDeadlineAt, null, "Must NOT fall back to expiresAt");
});
