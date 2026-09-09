import test from "node:test";
import assert from "node:assert/strict";
import { NotificationsService } from "./notifications.service";
import { encodeNotificationCursor } from "./notification-cursor.util";

test("NotificationsService", async (t) => {
  const dummySecret = "test-session-secret-must-be-long-enough-32bytes";
  const mockConfig = {
    cursorSigningSecret: dummySecret
  } as any;

  await t.test("getUnreadCount returns count of unread notifications", async () => {
    const mockPrisma = {
      notification: {
        count: async ({ where }: any) => {
          assert.equal(where.userId, "user-1");
          assert.equal(where.readAt, null);
          return 4;
        }
      }
    } as any;

    const service = new NotificationsService(mockPrisma, mockConfig);
    const result = await service.getUnreadCount("user-1");
    assert.deepEqual(result, { unreadCount: 4 });
  });

  await t.test("markAllAsRead updates unread items and returns count", async () => {
    const mockPrisma = {
      notification: {
        updateMany: async ({ where, data }: any) => {
          assert.equal(where.userId, "user-1");
          assert.equal(where.readAt, null);
          assert.ok(data.readAt instanceof Date);
          return { count: 3 };
        }
      }
    } as any;

    const service = new NotificationsService(mockPrisma, mockConfig);
    const result = await service.markAllAsRead("user-1");
    assert.deepEqual(result, { count: 3 });
  });

  await t.test("markAsRead updates a single unread notification", async () => {
    const mockPrisma = {
      notification: {
        findFirst: async ({ where }: any) => {
          assert.equal(where.id, "notif-1");
          assert.equal(where.userId, "user-1");
          return {
            id: "notif-1",
            type: "ALERT_MATCH",
            title: "New Role Matched",
            body: "A role matched your alert",
            linkUrl: "/app/jobs/job-1",
            readAt: null,
            createdAt: new Date("2026-09-09T12:00:00Z"),
            metadata: { jobId: "job-1" }
          };
        },
        update: async ({ where, data }: any) => {
          assert.equal(where.id, "notif-1");
          return {
            id: "notif-1",
            type: "ALERT_MATCH",
            title: "New Role Matched",
            body: "A role matched your alert",
            linkUrl: "/app/jobs/job-1",
            readAt: data.readAt,
            createdAt: new Date("2026-09-09T12:00:00Z"),
            metadata: { jobId: "job-1" }
          };
        }
      }
    } as any;

    const service = new NotificationsService(mockPrisma, mockConfig);
    const result = await service.markAsRead("user-1", "notif-1");
    assert.equal(result.id, "notif-1");
    assert.ok(result.readAt !== null);
  });

  await t.test("listNotifications returns paginated items and cursor", async () => {
    const notif1 = {
      id: "n-2",
      type: "ALERT_MATCH",
      title: "Title 2",
      body: "Body 2",
      linkUrl: null,
      readAt: null,
      createdAt: new Date("2026-09-09T10:00:00Z"),
      metadata: null
    };
    const notif2 = {
      id: "n-1",
      type: "ALERT_MATCH",
      title: "Title 1",
      body: "Body 1",
      linkUrl: null,
      readAt: null,
      createdAt: new Date("2026-09-09T09:00:00Z"),
      metadata: null
    };

    const mockPrisma = {
      notification: {
        findMany: async ({ take }: any) => {
          // returns 2 items when limit is 1
          return [notif1, notif2];
        },
        count: async () => 2
      }
    } as any;

    const service = new NotificationsService(mockPrisma, mockConfig);
    const result = await service.listNotifications("user-1", { limit: 1 });

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].id, "n-2");
    assert.equal(result.hasMore, true);
    assert.ok(result.nextCursor !== null);
    assert.equal(result.unreadCount, 2);
  });
});
