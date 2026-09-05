import assert from "node:assert/strict";
import { test } from "node:test";
import { JobStatus, WorkMode } from "@prisma/client";
import { JobsService } from "./jobs.service";

test("jobs list uses stable opaque cursor pagination without missing records", async () => {
  const base = new Date("2026-09-05T00:00:00.000Z");
  const rows = Array.from({ length: 3 }, (_, index) => jobRow(`job-${3 - index}`, base));
  const prisma = {
    job: {
      findMany: async ({ where, take }: any) => {
        let page = [...rows];
        if (where.OR) {
          page = page.filter((row) => {
            const cursorId = "job-2";
            return row.id < cursorId;
          });
        }
        return page.slice(0, take);
      },
      findUnique: async () => null
    }
  };
  const service = new JobsService(prisma as never);

  const first = await service.list(undefined, 2);
  const second = await service.list(first.pageInfo.nextCursor ?? undefined, 2);

  assert.deepEqual(first.data.map((job) => job.id), ["job-3", "job-2"]);
  assert.deepEqual(second.data.map((job) => job.id), ["job-1"]);
  assert.equal(second.pageInfo.nextCursor, null);
});

function jobRow(id: string, publishedAt: Date) {
  return {
    id,
    slug: id,
    canonicalTitle: id,
    normalizedRole: null,
    seniority: null,
    employmentType: null,
    descriptionText: null,
    descriptionHtml: null,
    workMode: WorkMode.REMOTE,
    remoteScope: "WORLDWIDE",
    remoteRestrictions: { scope: "WORLDWIDE", countries: [], labels: [], timezones: [] },
    remoteCountryCodes: [],
    remoteRestrictionLabels: [],
    remoteTimezoneRestrictions: [],
    requiredSkills: [],
    preferredSkills: [],
    authorization: null,
    contentHash: null,
    status: JobStatus.ACTIVE,
    moderationState: "approved",
    sourceDisclosure: null,
    canonicalFingerprint: null,
    searchDocument: null,
    publishedAt,
    sourcePublishedAt: publishedAt,
    sourceUpdatedAt: publishedAt,
    discoveredAt: publishedAt,
    firstSeenAt: publishedAt,
    lastSeenAt: publishedAt,
    verifiedAt: null,
    updatedAt: publishedAt,
    expiresAt: null,
    providerExpiresAt: null,
    applicationDeadlineAt: null,
    deadlineMetadata: null,
    expiredAt: null,
    companyId: null,
    sourceId: null,
    primaryOccurrenceId: null,
    company: null,
    source: null,
    salaries: [],
    locations: [],
    providerRecords: []
  };
}
