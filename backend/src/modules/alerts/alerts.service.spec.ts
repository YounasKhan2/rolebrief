import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { AlertStatus, AlertCadence, AlertChannel, AlertEligibilityPolicy } from "@prisma/client";
import { AlertsService, MAX_ALERTS_PER_USER } from "./alerts.service";

test("AlertsService - enforces max alerts per user limit", async () => {
  const prisma: any = {
    alert: {
      count: async () => MAX_ALERTS_PER_USER
    }
  };
  const mockConfig: any = { cursorSigningSecret: "test-secret-must-be-long-enough-for-hmac-32" };
  const service = new AlertsService(prisma, mockConfig);

  await assert.rejects(
    async () => {
      await service.createAlert("user-1", {
        name: "Test Alert",
        channel: AlertChannel.BOTH,
        cadence: AlertCadence.DAILY,
        deliveryHourUtc: 9,
        criteria: {
          version: 1,
          targetTitles: ["Engineer"],
          workModes: [],
          employmentTypes: [],
          countryCodes: [],
          providers: [],
          eligibilityPolicy: AlertEligibilityPolicy.NO_KNOWN_CONFLICTS,
          alignment: "ANY"
        }
      });
    },
    (err: any) => err instanceof BadRequestException
  );
});

test("AlertsService - normalizes and trims criteria fields on creation", async () => {
  const prisma: any = {
    alert: {
      count: async () => 0,
      create: async (args: any) => ({
        id: "alert-1",
        userId: args.data.userId,
        name: args.data.name,
        status: AlertStatus.ACTIVE,
        channel: args.data.channel,
        cadence: args.data.cadence,
        deliveryHourUtc: args.data.deliveryHourUtc,
        deliveryDayOfWeek: args.data.deliveryDayOfWeek,
        workModes: args.data.workModes,
        employmentTypes: args.data.employmentTypes,
        countryCodes: args.data.countryCodes,
        providers: args.data.providers,
        salaryDisclosed: args.data.salaryDisclosed,
        eligibilityPolicy: args.data.eligibilityPolicy,
        criteriaJson: args.data.criteriaJson,
        revision: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      })
    }
  };
  const mockConfig: any = { cursorSigningSecret: "test-secret-must-be-long-enough-for-hmac-32" };
  const service = new AlertsService(prisma, mockConfig);

  const res = await service.createAlert("user-1", {
    name: "  Senior Frontend  ",
    channel: AlertChannel.IN_APP,
    cadence: AlertCadence.IMMEDIATE,
    deliveryHourUtc: 9,
    criteria: {
      version: 1,
      targetTitles: ["  Frontend Developer  "],
      workModes: [],
      employmentTypes: [" FULL_TIME "],
      countryCodes: ["us"],
      providers: [],
      eligibilityPolicy: AlertEligibilityPolicy.NO_KNOWN_CONFLICTS,
      alignment: "STRONG_ALIGNMENT"
    }
  });

  assert.equal(res.name, "Senior Frontend");
  assert.deepEqual(res.criteria.targetTitles, ["Frontend Developer"]);
  assert.deepEqual(res.criteria.countryCodes, ["US"]);
  assert.equal(res.revision, 0);
});

test("AlertsService - rejects update with 409 Conflict if expectedRevision does not match", async () => {
  const prisma: any = {
    alert: {
      findFirst: async () => ({
        id: "alert-1",
        userId: "user-1",
        revision: 3
      })
    }
  };
  const mockConfig: any = { cursorSigningSecret: "test-secret-must-be-long-enough-for-hmac-32" };
  const service = new AlertsService(prisma, mockConfig);

  await assert.rejects(
    async () => {
      await service.updateAlert("user-1", "alert-1", {
        expectedRevision: 2,
        name: "Updated Name"
      });
    },
    (err: any) => err instanceof ConflictException
  );
});

test("AlertsService - atomically updates and increments revision when expectedRevision matches", async () => {
  const prisma: any = {
    alert: {
      findFirst: async () => ({
        id: "alert-1",
        userId: "user-1",
        revision: 2
      }),
      updateMany: async () => ({ count: 1 }),
      findUniqueOrThrow: async () => ({
        id: "alert-1",
        userId: "user-1",
        name: "New Name",
        status: AlertStatus.ACTIVE,
        channel: AlertChannel.BOTH,
        cadence: AlertCadence.DAILY,
        deliveryHourUtc: 9,
        deliveryDayOfWeek: null,
        revision: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
        criteriaJson: {
          version: 1,
          targetTitles: [],
          workModes: [],
          employmentTypes: [],
          countryCodes: [],
          providers: [],
          eligibilityPolicy: AlertEligibilityPolicy.NO_KNOWN_CONFLICTS,
          alignment: "ANY"
        }
      })
    }
  };
  const mockConfig: any = { cursorSigningSecret: "test-secret-must-be-long-enough-for-hmac-32" };
  const service = new AlertsService(prisma, mockConfig);

  const res = await service.updateAlert("user-1", "alert-1", {
    expectedRevision: 2,
    name: "New Name"
  });

  assert.equal(res.revision, 3);
  assert.equal(res.name, "New Name");
});

test("AlertsService - setStatus toggles status and increments revision", async () => {
  const prisma: any = {
    alert: {
      findFirst: async () => ({
        id: "alert-1",
        userId: "user-1",
        status: AlertStatus.ACTIVE,
        revision: 1
      }),
      updateMany: async () => ({ count: 1 }),
      findUniqueOrThrow: async () => ({
        id: "alert-1",
        userId: "user-1",
        name: "Alert",
        status: AlertStatus.PAUSED,
        channel: AlertChannel.BOTH,
        cadence: AlertCadence.DAILY,
        deliveryHourUtc: 9,
        deliveryDayOfWeek: null,
        revision: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
        criteriaJson: {
          version: 1,
          targetTitles: [],
          workModes: [],
          employmentTypes: [],
          countryCodes: [],
          providers: [],
          eligibilityPolicy: AlertEligibilityPolicy.NO_KNOWN_CONFLICTS,
          alignment: "ANY"
        }
      })
    }
  };
  const mockConfig: any = { cursorSigningSecret: "test-secret-must-be-long-enough-for-hmac-32" };
  const service = new AlertsService(prisma, mockConfig);

  const res = await service.setStatus("user-1", "alert-1", AlertStatus.PAUSED, 1);
  assert.equal(res.status, AlertStatus.PAUSED);
  assert.equal(res.revision, 2);
});

test("AlertsService - handleUnsubscribe pauses alert with valid token", async () => {
  const dummySecret = "test-secret-must-be-long-enough-for-hmac-32";
  const { generateAlertUnsubscribeToken } = await import("./alert-unsubscribe.util");
  const token = generateAlertUnsubscribeToken("alert-1", "user-1", dummySecret, "pause");

  let updatedStatus: any = null;
  const prisma: any = {
    alert: {
      findFirst: async () => ({
        id: "alert-1",
        userId: "user-1",
        status: AlertStatus.ACTIVE
      }),
      update: async ({ data }: any) => {
        updatedStatus = data.status;
        return { id: "alert-1", status: data.status };
      }
    }
  };
  const mockConfig: any = { cursorSigningSecret: dummySecret };
  const service = new AlertsService(prisma, mockConfig);

  const res = await service.handleUnsubscribe(token);
  assert.equal(res.success, true);
  assert.equal(res.action, "paused");
  assert.equal(updatedStatus, AlertStatus.PAUSED);
});

test("JobOutboxDispatcherService - reaps stalled events older than 15 minutes", async () => {
  const { JobOutboxDispatcherService } = await import("./job-outbox-dispatcher.service");
  const { OutboxStatus } = await import("@prisma/client");

  let updatedIds: string[] = [];
  let updateData: any = null;

  const prisma: any = {
    $transaction: async (fn: any) => fn(prisma),
    $queryRaw: async () => [
      { id: "event-stalled-1", attempts: 1 },
      { id: "event-stalled-2", attempts: 2 }
    ],
    jobOutboxEvent: {
      updateMany: async ({ where, data }: any) => {
        updatedIds.push(...where.id.in);
        updateData = data;
        return { count: where.id.in.length };
      }
    }
  };
  const mockQueue: any = {};
  const dispatcher = new JobOutboxDispatcherService(prisma, mockQueue);

  const res = await dispatcher.reapStalledEvents(15 * 60 * 1000, 5);
  assert.equal(res.reset, 2);
  assert.equal(res.failed, 0);
  assert.equal(updatedIds.length, 2);
  assert.equal(updateData.status, OutboxStatus.PENDING);
});

test("JobOutboxDispatcherService - does not touch fresh events when none returned by query", async () => {
  const { JobOutboxDispatcherService } = await import("./job-outbox-dispatcher.service");

  const prisma: any = {
    $transaction: async (fn: any) => fn(prisma),
    $queryRaw: async () => [], // No stalled events older than cutoff
    jobOutboxEvent: {
      updateMany: async () => {
        throw new Error("Should not update any events");
      }
    }
  };
  const mockQueue: any = {};
  const dispatcher = new JobOutboxDispatcherService(prisma, mockQueue);

  const res = await dispatcher.reapStalledEvents(15 * 60 * 1000, 5);
  assert.equal(res.reset, 0);
  assert.equal(res.failed, 0);
});

test("JobOutboxDispatcherService - marks max-attempt events as FAILED to prevent infinite loops", async () => {
  const { JobOutboxDispatcherService } = await import("./job-outbox-dispatcher.service");
  const { OutboxStatus } = await import("@prisma/client");

  const updates: Array<{ ids: string[]; data: any }> = [];

  const prisma: any = {
    $transaction: async (fn: any) => fn(prisma),
    $queryRaw: async () => [
      { id: "event-stalled-retryable", attempts: 3 },
      { id: "event-stalled-exhausted", attempts: 5 }
    ],
    jobOutboxEvent: {
      updateMany: async ({ where, data }: any) => {
        updates.push({ ids: where.id.in, data });
        return { count: where.id.in.length };
      }
    }
  };
  const mockQueue: any = {};
  const dispatcher = new JobOutboxDispatcherService(prisma, mockQueue);

  const res = await dispatcher.reapStalledEvents(15 * 60 * 1000, 5);
  assert.equal(res.reset, 1);
  assert.equal(res.failed, 1);

  const failedUpdate = updates.find((u) => u.ids.includes("event-stalled-exhausted"));
  assert.ok(failedUpdate);
  assert.equal(failedUpdate.data.status, OutboxStatus.FAILED);

  const resetUpdate = updates.find((u) => u.ids.includes("event-stalled-retryable"));
  assert.ok(resetUpdate);
  assert.equal(resetUpdate.data.status, OutboxStatus.PENDING);
});
