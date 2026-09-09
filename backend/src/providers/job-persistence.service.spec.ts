import assert from "node:assert/strict";
import test from "node:test";
import { JobPersistenceService } from "./job-persistence.service";
import type { CanonicalJobInput } from "./provider-adapter";

test("JobPersistenceService never writes firstSeenAt during provider create or update", async () => {
  let capturedCreate: Record<string, unknown> | null = null;
  let capturedUpdate: Record<string, unknown> | null = null;
  const prisma = {
    $transaction: async (fn: any) =>
      fn({
        source: {
          upsert: async () => ({ id: "source-1" })
        },
        company: {
          upsert: async () => ({ id: "company-1" })
        },
        providerRecord: {
          findUnique: async () => ({ contentHash: "old-hash" }),
          upsert: async () => ({ id: "provider-record-1" })
        },
        job: {
          upsert: async (args: any) => {
            capturedCreate = args.create;
            capturedUpdate = args.update;
            return { id: "job-1" };
          }
        },
        salary: {
          deleteMany: async () => undefined
        },
        jobLocation: {
          deleteMany: async () => undefined
        }
      })
  };
  const service = new JobPersistenceService(prisma as any);

  await service.persist("himalayas.guid", canonicalJob());

  assert.ok(capturedCreate, "create payload should be captured");
  assert.ok(capturedUpdate, "update payload should be captured");
  assert.equal(Object.prototype.hasOwnProperty.call(capturedCreate, "firstSeenAt"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(capturedUpdate, "firstSeenAt"), false);
});

function canonicalJob(): CanonicalJobInput {
  return {
    externalId: "provider-guid-1",
    slug: "provider-guid-1-role",
    title: "Backend Engineer",
    companySlug: "example",
    companyName: "Example",
    companyLogo: null,
    descriptionHtml: "<p>Build APIs.</p>",
    descriptionText: "Build APIs.",
    employmentType: "Full Time",
    seniority: "Senior",
    workMode: "REMOTE",
    remote: {
      scope: "WORLDWIDE",
      countries: [],
      countryCodes: [],
      labels: [],
      unresolvedLabels: [],
      timezones: [],
      timezoneOffsetMinutes: []
    },
    sourcePublishedAt: new Date("2026-09-01T00:00:00.000Z"),
    sourceUpdatedAt: new Date("2026-09-02T00:00:00.000Z"),
    providerExpiresAt: null,
    applicationDeadlineAt: null,
    applicationUrl: "https://example.com/apply",
    sourceUrl: "https://example.com/job",
    contentHash: "new-hash",
    canonicalFingerprint: "fingerprint",
    categories: ["Engineering"],
    parentCategories: ["Software"],
    salary: null,
    raw: { id: "provider-guid-1" }
  };
}
