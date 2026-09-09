import test from "node:test";
import assert from "node:assert/strict";
import {
  AlertChannel,
  AlertMatchEmailState,
  AlertStatus,
  EmailDeliveryStatus,
  JobStatus,
  UserStatus
} from "@prisma/client";
import { EmailDeliveryProcessor } from "./email.processor";
import { SEND_AUTH_EMAIL_JOB } from "../../queue/queue.constants";

test("EmailDeliveryProcessor - suppresses email if alert is paused or deleted", async () => {
  let suppressedDeliveryId: string | null = null;
  let suppressedMatchId: string | null = null;
  let matchEmailState: string | null = null;

  const prisma: any = {
    emailDelivery: {
      findUnique: async () => ({
        id: "deliv-1",
        userId: "user-1",
        template: "alert-match",
        toEmail: "user@example.com",
        dedupeKey: "key-1",
        status: EmailDeliveryStatus.QUEUED
      }),
      update: async ({ where, data }: any) => {
        if (data.status === EmailDeliveryStatus.FAILED) {
          suppressedDeliveryId = where.id;
        }
        return { id: where.id, ...data };
      }
    },
    user: {
      findUnique: async () => ({ id: "user-1", status: UserStatus.ACTIVE })
    },
    alert: {
      // Alert is PAUSED
      findUnique: async () => ({
        id: "alert-1",
        status: AlertStatus.PAUSED,
        channel: AlertChannel.BOTH
      })
    },
    alertMatch: {
      update: async ({ where, data }: any) => {
        suppressedMatchId = where.id;
        matchEmailState = data.emailState;
        return { id: where.id, ...data };
      }
    }
  };

  const mockConfig: any = {
    auth: {
      email: {
        provider: "fake",
        replyTo: "support@rolebrief.com"
      }
    }
  };
  const mockFakeProvider: any = {
    send: async () => {
      throw new Error("Provider should not be called on suppressed delivery");
    }
  };
  const mockResendProvider: any = {};

  const processor = new EmailDeliveryProcessor(
    prisma,
    mockConfig,
    mockFakeProvider,
    mockResendProvider
  );

  const res = await processor.process({
    name: SEND_AUTH_EMAIL_JOB,
    data: {
      deliveryId: "deliv-1",
      alertId: "alert-1",
      jobId: "job-1",
      matchRecordId: "match-1",
      payload: { alertName: "Test Alert", role: { title: "Dev" } }
    }
  } as any);

  assert.equal(res.sent, false);
  assert.equal(res.suppressed, true);
  assert.equal(res.reason, "alert_paused_or_deleted");
  assert.equal(suppressedDeliveryId, "deliv-1");
  assert.equal(suppressedMatchId, "match-1");
  assert.equal(matchEmailState, AlertMatchEmailState.SUPPRESSED);
});

test("EmailDeliveryProcessor - suppresses email if job is expired or missing apply link", async () => {
  let suppressedDeliveryId: string | null = null;
  let matchEmailState: string | null = null;

  const prisma: any = {
    emailDelivery: {
      findUnique: async () => ({
        id: "deliv-2",
        userId: "user-1",
        template: "alert-match",
        toEmail: "user@example.com",
        dedupeKey: "key-2",
        status: EmailDeliveryStatus.QUEUED
      }),
      update: async ({ where, data }: any) => {
        if (data.status === EmailDeliveryStatus.FAILED) {
          suppressedDeliveryId = where.id;
        }
        return { id: where.id, ...data };
      }
    },
    user: {
      findUnique: async () => ({ id: "user-1", status: UserStatus.ACTIVE })
    },
    alert: {
      findUnique: async () => ({
        id: "alert-1",
        status: AlertStatus.ACTIVE,
        channel: AlertChannel.BOTH
      })
    },
    job: {
      // Job is marked EXPIRED and has no application link
      findUnique: async () => ({
        id: "job-expired-1",
        status: JobStatus.EXPIRED,
        occurrences: [],
        source: null
      })
    },
    alertMatch: {
      update: async ({ where, data }: any) => {
        matchEmailState = data.emailState;
        return { id: where.id, ...data };
      }
    }
  };

  const mockConfig: any = {
    auth: {
      email: {
        provider: "fake",
        replyTo: "support@rolebrief.com"
      }
    }
  };
  const mockFakeProvider: any = {
    send: async () => {
      throw new Error("Provider should not be called on suppressed delivery");
    }
  };
  const mockResendProvider: any = {};

  const processor = new EmailDeliveryProcessor(
    prisma,
    mockConfig,
    mockFakeProvider,
    mockResendProvider
  );

  const res = await processor.process({
    name: SEND_AUTH_EMAIL_JOB,
    data: {
      deliveryId: "deliv-2",
      alertId: "alert-1",
      jobId: "job-expired-1",
      matchRecordId: "match-2",
      payload: { alertName: "Test Alert", role: { title: "Dev" } }
    }
  } as any);

  assert.equal(res.sent, false);
  assert.equal(res.suppressed, true);
  assert.equal(res.reason, "job_expired_or_invalid");
  assert.equal(suppressedDeliveryId, "deliv-2");
  assert.equal(matchEmailState, AlertMatchEmailState.SUPPRESSED);
});

test("EmailDeliveryProcessor - suppresses email if user is deleted or disabled", async () => {
  const prisma: any = {
    emailDelivery: {
      findUnique: async () => ({
        id: "deliv-3",
        userId: "user-deleted",
        template: "alert-match",
        toEmail: "user@example.com",
        dedupeKey: "key-3",
        status: EmailDeliveryStatus.QUEUED
      }),
      update: async () => ({})
    },
    user: {
      findUnique: async () => null // User no longer exists
    }
  };

  const mockConfig: any = {
    auth: {
      email: {
        provider: "fake",
        replyTo: "support@rolebrief.com"
      }
    }
  };
  const mockFakeProvider: any = {};
  const mockResendProvider: any = {};

  const processor = new EmailDeliveryProcessor(
    prisma,
    mockConfig,
    mockFakeProvider,
    mockResendProvider
  );

  const res = await processor.process({
    name: SEND_AUTH_EMAIL_JOB,
    data: {
      deliveryId: "deliv-3",
      alertId: "alert-1",
      jobId: "job-1",
      matchRecordId: "match-3",
      payload: { alertName: "Test Alert", role: { title: "Dev" } }
    }
  } as any);

  assert.equal(res.sent, false);
  assert.equal(res.suppressed, true);
  assert.equal(res.reason, "user_inactive_or_deleted");
});
