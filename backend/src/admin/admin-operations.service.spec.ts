import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { JobStatus } from "@prisma/client";
import { AdminOperationsService } from "./admin-operations.service";
import { AdminModerationActionType } from "./dto/admin-operations.dto";

test("AdminOperationsService - getMetrics returns aggregated platform counters", async () => {
  const prisma: any = {
    user: {
      count: async (args?: any) => {
        if (!args) return 150;
        if (args.where?.status === "ACTIVE") return 120;
        if (args.where?.status === "LOCKED") return 5;
        if (args.where?.status === "DISABLED") return 25;
        return 0;
      }
    },
    job: {
      count: async (args?: any) => {
        if (!args) return 1000;
        if (args.where?.status === JobStatus.ACTIVE) return 850;
        if (args.where?.status === JobStatus.STALE) return 80;
        if (args.where?.status === JobStatus.EXPIRED) return 50;
        if (args.where?.status === JobStatus.SUSPICIOUS) return 20;
        if (args.where?.moderationState === "flagged") return 15;
        if (args.where?.moderationState === "pending") return 35;
        return 0;
      }
    },
    ingestionRun: {
      count: async (args?: any) => {
        if (args.where?.status === "failed") return 1;
        return 24;
      },
      aggregate: async () => ({
        _sum: { recordsCreated: 340, recordsUpdated: 120 }
      })
    },
    jobOutboxEvent: {
      count: async (args?: any) => {
        if (args.where?.status === "PENDING") return 3;
        if (args.where?.status === "FAILED") return 0;
        return 0;
      }
    },
    emailDelivery: {
      count: async (args?: any) => {
        if (args.where?.status === "QUEUED") return 2;
        if (args.where?.status === "FAILED") return 0;
        return 0;
      }
    },
    alert: {
      count: async () => 45
    }
  };

  const config: any = { himalayas: { enabled: true, cron: "0 3 * * *" } };
  const rateLimit: any = { consume: async () => ({ allowed: true }) };
  const queue: any = { add: async () => ({ id: "job-1" }) };

  const service = new AdminOperationsService(prisma, config, rateLimit, queue);
  const metrics = await service.getMetrics();

  assert.equal(metrics.users.total, 150);
  assert.equal(metrics.users.active, 120);
  assert.equal(metrics.jobs.active, 850);
  assert.equal(metrics.jobs.suspicious, 20);
  assert.equal(metrics.ingestion.runsLast24h, 24);
  assert.equal(metrics.ingestion.failedRunsLast24h, 1);
  assert.equal(metrics.ingestion.recordsCreatedLast24h, 340);
  assert.equal(metrics.pipelines.alertsActive, 45);
});

test("AdminOperationsService - getSources returns Himalayas provider status and stats", async () => {
  const prisma: any = {
    ingestionRun: {
      findFirst: async () => ({
        id: "run-1",
        status: "completed",
        startedAt: new Date("2026-09-09T03:00:00Z"),
        finishedAt: new Date("2026-09-09T03:05:00Z"),
        recordsFetched: 50,
        recordsCreated: 10,
        recordsUpdated: 40,
        recordsExpired: 0,
        stopReason: null
      }),
      count: async (args?: any) => {
        if (args?.where?.status === "failed") return 0;
        return 12;
      },
      aggregate: async () => ({
        _sum: { recordsCreated: 45 }
      })
    },
    ingestionCheckpoint: {
      findFirst: async () => ({
        mode: "incremental",
        updatedAt: new Date("2026-09-09T03:05:00Z"),
        cursor: "cur-123"
      })
    }
  };

  const config: any = { himalayas: { enabled: true, cron: "0 3 * * *" } };
  const rateLimit: any = { consume: async () => ({ allowed: true }) };
  const queue: any = { add: async () => ({ id: "job-1" }) };

  const service = new AdminOperationsService(prisma, config, rateLimit, queue);
  const { sources } = await service.getSources();

  assert.equal(sources.length, 1);
  assert.equal(sources[0].id, "himalayas");
  assert.equal(sources[0].status, "healthy");
  assert.equal(sources[0].enabled, true);
  assert.equal(sources[0].lastRun?.recordsCreated, 10);
  assert.equal(sources[0].checkpoint?.cursor, "cur-123");
  assert.equal(sources[0].stats24h.runs, 12);
});

test("AdminOperationsService - triggerSync enqueues Himalayas job and records AuditEvent", async () => {
  const auditCalls: any[] = [];
  const queueCalls: any[] = [];
  const rateLimitCalls: any[] = [];

  const prisma: any = {
    auditEvent: {
      create: async (args: any) => {
        auditCalls.push(args);
        return { id: "audit-1" };
      }
    }
  };

  const config: any = { himalayas: { enabled: true } };
  const rateLimit: any = {
    consume: async (opts: any) => {
      rateLimitCalls.push(opts);
      return { allowed: true };
    }
  };
  const queue: any = {
    add: async (jobName: string, data: any, opts: any) => {
      queueCalls.push({ jobName, data, opts });
      return { id: "bull-job-999" };
    }
  };

  const service = new AdminOperationsService(prisma, config, rateLimit, queue);
  const result = await service.triggerSync("himalayas", "admin-user-1");

  assert.equal(result.queued, true);
  assert.equal(result.jobId, "bull-job-999");
  assert.equal(rateLimitCalls.length, 1);
  assert.equal(rateLimitCalls[0].namespace, "admin_provider_sync");
  assert.equal(rateLimitCalls[0].limit, 1);
  assert.equal(queueCalls.length, 1);
  assert.equal(queueCalls[0].jobName, "providers.himalayas.ingest");
  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0].data.action, "admin.source.sync_triggered");
  assert.equal(auditCalls[0].data.actorId, "admin-user-1");
});

test("AdminOperationsService - triggerSync rejects invalid provider", async () => {
  const service = new AdminOperationsService({} as any, {} as any, {} as any, {} as any);
  await assert.rejects(
    async () => {
      await service.triggerSync("unsupported-provider", "admin-1");
    },
    (err: any) => err instanceof BadRequestException
  );
});

test("AdminOperationsService - executeModerationAction handles APPROVE and updates status and moderationState", async () => {
  let updatedJobData: any = null;
  let auditData: any = null;

  const prisma: any = {
    job: {
      findUnique: async () => ({
        id: "job-1",
        slug: "senior-engineer",
        status: JobStatus.SUSPICIOUS,
        moderationState: "flagged",
        canonicalTitle: "Senior Engineer"
      }),
      update: async (args: any) => {
        updatedJobData = args;
        return { id: "job-1", slug: "senior-engineer", status: args.data.status, moderationState: args.data.moderationState };
      }
    },
    auditEvent: {
      create: async (args: any) => {
        auditData = args;
        return { id: "audit-2" };
      }
    },
    ['stransaction'.replace('s', '$')]: async (ops: any[]) => Promise.all(ops)
  };

  const service = new AdminOperationsService(prisma, {} as any, {} as any, {} as any);
  const result = await service.executeModerationAction("admin-1", "job-1", {
    action: AdminModerationActionType.APPROVE,
    notes: "Verified legitimate company listing"
  });

  assert.equal(result.success, true);
  assert.equal(updatedJobData.data.status, JobStatus.ACTIVE);
  assert.equal(updatedJobData.data.moderationState, "approved");
  assert.equal(auditData.data.action, "admin.moderation.approve");
  assert.equal(auditData.data.targetId, "job-1");
  assert.equal(auditData.data.metadata.notes, "Verified legitimate company listing");
});

test("AdminOperationsService - executeModerationAction handles REMOVE", async () => {
  let updatedJobData: any = null;

  const prisma: any = {
    job: {
      findUnique: async () => ({
        id: "job-2",
        slug: "fake-lead",
        status: JobStatus.ACTIVE,
        moderationState: "pending",
        canonicalTitle: "Fake Lead"
      }),
      update: async (args: any) => {
        updatedJobData = args;
        return { id: "job-2", slug: "fake-lead", status: args.data.status, moderationState: args.data.moderationState };
      }
    },
    auditEvent: {
      create: async () => ({ id: "audit-3" })
    },
    ['stransaction'.replace('s', '$')]: async (ops: any[]) => Promise.all(ops)
  };

  const service = new AdminOperationsService(prisma, {} as any, {} as any, {} as any);
  const result = await service.executeModerationAction("admin-1", "job-2", {
    action: AdminModerationActionType.REMOVE
  });

  assert.equal(result.success, true);
  assert.equal(updatedJobData.data.status, JobStatus.EXPIRED);
  assert.equal(updatedJobData.data.moderationState, "removed");
});

test("AdminOperationsService - executeModerationAction throws NotFoundException for missing job", async () => {
  const prisma: any = {
    job: {
      findUnique: async () => null
    }
  };

  const service = new AdminOperationsService(prisma, {} as any, {} as any, {} as any);
  await assert.rejects(
    async () => {
      await service.executeModerationAction("admin-1", "missing-job", { action: AdminModerationActionType.DISMISS });
    },
    (err: any) => err instanceof NotFoundException
  );
});
