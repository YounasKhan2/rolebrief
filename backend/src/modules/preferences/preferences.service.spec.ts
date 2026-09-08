import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { ContrastPreference, MotionPreference } from "@prisma/client";
import {
  PreferencesService,
  validateAndNormalizeTimezone
} from "./preferences.service";

function createMockPrisma(overrides: Record<string, any> = {}) {
  let prefRow: any = overrides.initialPref ?? null;
  let userRow: any = overrides.initialUser ?? {
    id: "user_1",
    timezone: "UTC"
  };
  const auditEvents: any[] = [];

  const client: any = {
    user: {
      findUnique: async () => ({ ...userRow }),
      update: async ({ data }: any) => {
        userRow = { ...userRow, ...data };
        return { ...userRow };
      }
    },
    userPreference: {
      findUnique: async () => (prefRow ? { ...prefRow } : null),
      findUniqueOrThrow: async () => {
        if (!prefRow) throw new Error("Not found");
        return { ...prefRow };
      },
      create: async ({ data }: any) => {
        prefRow = {
          id: "pref_1",
          userId: data.userId,
          productUpdates: data.productUpdates ?? false,
          productUpdatesConsentUpdatedAt: data.productUpdatesConsentUpdatedAt ?? null,
          marketingEmails: data.marketingEmails ?? false,
          marketingConsentUpdatedAt: data.marketingConsentUpdatedAt ?? null,
          motionPreference: data.motionPreference ?? MotionPreference.SYSTEM,
          contrastPreference: data.contrastPreference ?? ContrastPreference.SYSTEM,
          revision: data.revision ?? 1,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        return { ...prefRow };
      },
      updateMany: async ({ where, data }: any) => {
        if (!prefRow || prefRow.revision !== where.revision) {
          return { count: 0 };
        }
        const updatedData = { ...data };
        if (data.revision?.increment) {
          updatedData.revision = prefRow.revision + data.revision.increment;
        }
        prefRow = { ...prefRow, ...updatedData, updatedAt: new Date() };
        return { count: 1 };
      }
    },
    authAuditEvent: {
      create: async ({ data }: any) => {
        auditEvents.push(data);
        return data;
      }
    },
    getAuditEvents: () => auditEvents,
    getUserRow: () => userRow,
    getPrefRow: () => prefRow
  };

  client.$transaction = async (fn: any) => fn(client);

  return client;
}

test("validateAndNormalizeTimezone: accepts valid IANA timezones and normalizes", () => {
  const tz1 = validateAndNormalizeTimezone("America/New_York");
  assert.equal(tz1, "America/New_York");

  const tz2 = validateAndNormalizeTimezone("Europe/London");
  assert.equal(tz2, "Europe/London");

  const tz3 = validateAndNormalizeTimezone("UTC");
  assert.equal(tz3, "UTC");
});

test("validateAndNormalizeTimezone: rejects invalid timezone identifiers", () => {
  assert.throws(() => validateAndNormalizeTimezone("Invalid/Timezone_Not_Real"), {
    name: "BadRequestException"
  });
  assert.throws(() => validateAndNormalizeTimezone("   "), {
    name: "BadRequestException"
  });
  assert.throws(() => validateAndNormalizeTimezone("A".repeat(101)), {
    name: "BadRequestException"
  });
});

test("PreferencesService: getPreferences is pure read-only and returns virtual defaults without DB writes", async () => {
  const prisma = createMockPrisma();
  const service = new PreferencesService(prisma);

  const result = await service.getPreferences("user_1");
  assert.equal(result.preferences.productUpdates, false);
  assert.equal(result.preferences.marketingEmails, false);
  assert.equal(result.preferences.motionPreference, MotionPreference.SYSTEM);
  assert.equal(result.preferences.contrastPreference, ContrastPreference.SYSTEM);
  assert.equal(result.preferences.timezone, "UTC");
  assert.equal(result.preferences.revision, 0);
  assert.equal(result.preferences.isPersisted, false);
  assert.equal(result.preferences.updatedAt, null);

  // Assert NO row was created in database
  assert.equal(prisma.getPrefRow(), null);
});

test("PreferencesService: updatePreferences performs first-write with expectedRevision 0 and creates revision 1", async () => {
  const prisma = createMockPrisma();
  const service = new PreferencesService(prisma);

  const result = await service.updatePreferences("user_1", {
    expectedRevision: 0,
    productUpdates: true,
    motionPreference: MotionPreference.REDUCE,
    timezone: "America/Chicago"
  } as any);

  assert.equal(result.preferences.productUpdates, true);
  assert.equal(result.preferences.marketingEmails, false);
  assert.equal(result.preferences.motionPreference, MotionPreference.REDUCE);
  assert.equal(result.preferences.contrastPreference, ContrastPreference.SYSTEM);
  assert.equal(result.preferences.timezone, "America/Chicago");
  assert.equal(result.preferences.revision, 1);
  assert.equal(result.preferences.isPersisted, true);

  // Verify audit event recorded for consent
  const audits = prisma.getAuditEvents();
  assert.equal(audits.length, 1);
  assert.equal(audits[0].eventType, "preference.consent_changed");
  assert.equal(audits[0].metadata.category, "product_updates");
  assert.equal(audits[0].metadata.newValue, true);
});

test("PreferencesService: updatePreferences rejects first-write if expectedRevision is not 0", async () => {
  const prisma = createMockPrisma();
  const service = new PreferencesService(prisma);

  await assert.rejects(
    async () => {
      await service.updatePreferences("user_1", {
        expectedRevision: 1,
        productUpdates: true
      } as any);
    },
    (err: any) => {
      assert.ok(err instanceof ConflictException);
      return true;
    }
  );
});

test("PreferencesService: updatePreferences atomically updates and increments revision on subsequent write", async () => {
  const prisma = createMockPrisma({
    initialPref: {
      id: "pref_1",
      userId: "user_1",
      productUpdates: false,
      productUpdatesConsentUpdatedAt: null,
      marketingEmails: false,
      marketingConsentUpdatedAt: null,
      motionPreference: MotionPreference.SYSTEM,
      contrastPreference: ContrastPreference.SYSTEM,
      revision: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });
  const service = new PreferencesService(prisma);

  const result = await service.updatePreferences("user_1", {
    expectedRevision: 1,
    marketingEmails: true,
    contrastPreference: ContrastPreference.HIGH
  } as any);

  assert.equal(result.preferences.marketingEmails, true);
  assert.equal(result.preferences.contrastPreference, ContrastPreference.HIGH);
  assert.equal(result.preferences.revision, 2);

  // Check audit event
  const audits = prisma.getAuditEvents();
  assert.equal(audits.length, 1);
  assert.equal(audits[0].eventType, "preference.consent_changed");
  assert.equal(audits[0].metadata.category, "marketing");
  assert.equal(audits[0].metadata.newValue, true);
});

test("PreferencesService: updatePreferences throws 409 ConflictException on stale revision", async () => {
  const prisma = createMockPrisma({
    initialPref: {
      id: "pref_1",
      userId: "user_1",
      productUpdates: false,
      productUpdatesConsentUpdatedAt: null,
      marketingEmails: false,
      marketingConsentUpdatedAt: null,
      motionPreference: MotionPreference.SYSTEM,
      contrastPreference: ContrastPreference.SYSTEM,
      revision: 5,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });
  const service = new PreferencesService(prisma);

  await assert.rejects(
    async () => {
      await service.updatePreferences("user_1", {
        expectedRevision: 4, // Stale revision!
        productUpdates: true
      } as any);
    },
    (err: any) => {
      assert.ok(err instanceof ConflictException);
      return true;
    }
  );
});
