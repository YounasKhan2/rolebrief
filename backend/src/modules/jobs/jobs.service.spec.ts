import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { JobStatus, WorkMode } from "@prisma/client";
import { JobSortOption, JobsQueryDto } from "./dto/jobs-query.dto";
import { computeQueryHash, decodeCursor, encodeCursor } from "./jobs-cursor.util";
import { JobsSearchRepository, SearchResultItem } from "./jobs-search.repository";
import { JobsService } from "./jobs.service";

const TEST_SECRET = "test-secret-must-be-at-least-32-chars-long-for-hmac";

test("computeQueryHash produces deterministic hash for same query in different key order", () => {
  const hash1 = computeQueryHash({ q: "react developer", workMode: ["REMOTE"], sort: JobSortOption.NEWEST });
  const hash2 = computeQueryHash({ sort: JobSortOption.NEWEST, workMode: ["REMOTE"], q: "react developer" });
  assert.equal(hash1, hash2);
  assert.equal(typeof hash1, "string");
  assert.equal(hash1.length, 16);
});

test("computeQueryHash changes when filters change", () => {
  const hash1 = computeQueryHash({ q: "react" });
  const hash2 = computeQueryHash({ q: "vue" });
  const hash3 = computeQueryHash({ q: "react", country: ["CA"] });
  assert.notEqual(hash1, hash2);
  assert.notEqual(hash1, hash3);
});

test("HMAC cursor: valid cursor decodes and verifies successfully", () => {
  const qHash = computeQueryHash({ q: "react" });
  const cursor = encodeCursor(
    {
      v: 1,
      sort: JobSortOption.NEWEST,
      val: ["2026-09-05T00:00:00.000Z", "2026-09-05T00:00:00.000Z"],
      id: "job-1",
      qHash
    },
    TEST_SECRET
  );

  assert.ok(cursor.includes("."));
  const decoded = decodeCursor(cursor, TEST_SECRET, qHash);
  assert.equal(decoded.id, "job-1");
  assert.equal(decoded.sort, JobSortOption.NEWEST);
});

test("HMAC cursor: rejects modified payload (tampered payload)", () => {
  const qHash = computeQueryHash({ q: "react" });
  const cursor = encodeCursor(
    {
      v: 1,
      sort: JobSortOption.NEWEST,
      val: ["2026-09-05T00:00:00.000Z", "2026-09-05T00:00:00.000Z"],
      id: "job-1",
      qHash
    },
    TEST_SECRET
  );

  const [payloadBase64, sig] = cursor.split(".");
  // Tamper with payload by changing id
  const payloadObj = JSON.parse(Buffer.from(payloadBase64, "base64url").toString("utf8"));
  payloadObj.id = "job-tampered";
  const tamperedPayload = Buffer.from(JSON.stringify(payloadObj)).toString("base64url");
  const tamperedCursor = `${tamperedPayload}.${sig}`;

  assert.throws(
    () => decodeCursor(tamperedCursor, TEST_SECRET, qHash),
    (err: any) => err instanceof BadRequestException && err.message.includes("Invalid cursor signature")
  );
});

test("HMAC cursor: rejects modified signature (tampered signature)", () => {
  const qHash = computeQueryHash({ q: "react" });
  const cursor = encodeCursor(
    {
      v: 1,
      sort: JobSortOption.NEWEST,
      val: ["2026-09-05T00:00:00.000Z", "2026-09-05T00:00:00.000Z"],
      id: "job-1",
      qHash
    },
    TEST_SECRET
  );

  const [payloadBase64, sig] = cursor.split(".");
  const tamperedSig = sig.slice(0, -1) + (sig.slice(-1) === "A" ? "B" : "A");
  const tamperedCursor = `${payloadBase64}.${tamperedSig}`;

  assert.throws(
    () => decodeCursor(tamperedCursor, TEST_SECRET, qHash),
    (err: any) => err instanceof BadRequestException && err.message.includes("Invalid cursor signature")
  );
});

test("HMAC cursor: rejects cursor signed with wrong secret", () => {
  const qHash = computeQueryHash({ q: "react" });
  const cursorWithOtherSecret = encodeCursor(
    {
      v: 1,
      sort: JobSortOption.NEWEST,
      val: ["2026-09-05T00:00:00.000Z", "2026-09-05T00:00:00.000Z"],
      id: "job-1",
      qHash
    },
    "completely-different-signing-secret-key-12345"
  );

  assert.throws(
    () => decodeCursor(cursorWithOtherSecret, TEST_SECRET, qHash),
    (err: any) => err instanceof BadRequestException && err.message.includes("Invalid cursor signature")
  );
});

test("HMAC cursor: rejects malformed cursor (no dot or corrupt structure)", () => {
  assert.throws(
    () => decodeCursor("invalid-no-dot-cursor", TEST_SECRET),
    (err: any) => err instanceof BadRequestException && err.message.includes("expected signed cursor token")
  );
  assert.throws(
    () => decodeCursor("invalid..two.dots", TEST_SECRET),
    (err: any) => err instanceof BadRequestException
  );
  assert.throws(
    () => decodeCursor(".", TEST_SECRET),
    (err: any) => err instanceof BadRequestException
  );
});

test("HMAC cursor: rejects query mismatch even with valid signature", () => {
  const qHash1 = computeQueryHash({ q: "react" });
  const cursor = encodeCursor(
    {
      v: 1,
      sort: JobSortOption.NEWEST,
      val: ["2026-09-05T00:00:00.000Z", "2026-09-05T00:00:00.000Z"],
      id: "job-1",
      qHash: qHash1
    },
    TEST_SECRET
  );

  const differentQHash = computeQueryHash({ q: "python" });
  assert.throws(
    () => decodeCursor(cursor, TEST_SECRET, differentQHash),
    (err: any) => err instanceof BadRequestException && err.message.includes("invalid for the current query")
  );
});

test("jobs list uses stable signed cursor pagination and preserves ordering across pages", async () => {
  const base = new Date("2026-09-05T00:00:00.000Z");
  const allRows = Array.from({ length: 45 }, (_, i) => {
    const pub = new Date(base.getTime() - i * 3600_000);
    return mockJob(`job-${String(i + 1).padStart(2, "0")}`, pub, `Engineer ${i + 1}`);
  });

  const searchRepo = {
    searchJobIds: async (query: JobsQueryDto, cursor: any, limit: number) => {
      let filtered = [...allRows];
      if (cursor) {
        const cursorPub = cursor.val[0] ? new Date(cursor.val[0]).getTime() : 0;
        filtered = filtered.filter((r) => {
          const rPub = r.publishedAt?.getTime() ?? 0;
          if (rPub < cursorPub) return true;
          if (rPub === cursorPub) return r.id < cursor.id;
          return false;
        });
      }
      const page = filtered.slice(0, limit + 1);
      return {
        items: page.map((r) => ({
          id: r.id,
          sortVal1: r.publishedAt?.toISOString() ?? null,
          sortVal2: r.discoveredAt.toISOString()
        })),
        totalCount: allRows.length
      };
    },
    findRelatedJobs: async () => [],
    getFacets: async () => ({
      workMode: [],
      remoteScope: [],
      seniority: [],
      employmentType: [],
      country: [],
      category: [],
      provider: []
    })
  };

  const prisma = {
    job: {
      findMany: async ({ where }: any) => {
        const ids = where.id.in;
        return allRows.filter((r) => ids.includes(r.id));
      },
      findUnique: async () => null
    }
  };

  const mockConfig = { cursorSigningSecret: TEST_SECRET };
  const service = new JobsService(prisma as never, searchRepo as never, mockConfig as never);

  // Page 1 (limit 20)
  const page1 = await service.list({ limit: 20 });
  assert.equal(page1.data.length, 20);
  assert.equal(page1.totalCount, 45);
  assert.equal(page1.pageInfo.hasNextPage, true);
  assert.ok(page1.pageInfo.nextCursor);
  assert.ok(page1.pageInfo.nextCursor!.includes("."));
  assert.equal(page1.data[0].id, "job-01");
  assert.equal(page1.data[19].id, "job-20");

  // Page 2 (limit 20)
  const page2 = await service.list({ limit: 20, cursor: page1.pageInfo.nextCursor! });
  assert.equal(page2.data.length, 20);
  assert.equal(page2.totalCount, 45);
  assert.equal(page2.pageInfo.hasNextPage, true);
  assert.ok(page2.pageInfo.nextCursor);
  assert.equal(page2.data[0].id, "job-21");
  assert.equal(page2.data[19].id, "job-40");

  // Page 3 (limit 20, last 5 items)
  const page3 = await service.list({ limit: 20, cursor: page2.pageInfo.nextCursor! });
  assert.equal(page3.data.length, 5);
  assert.equal(page3.totalCount, 45);
  assert.equal(page3.pageInfo.hasNextPage, false);
  assert.equal(page3.pageInfo.nextCursor, null);
  assert.equal(page3.data[0].id, "job-41");
  assert.equal(page3.data[4].id, "job-45");

  // Verify zero dropped or duplicate records across all 3 pages
  const collectedIds = [
    ...page1.data.map((j) => j.id),
    ...page2.data.map((j) => j.id),
    ...page3.data.map((j) => j.id)
  ];
  assert.equal(collectedIds.length, 45);
  const uniqueIds = new Set(collectedIds);
  assert.equal(uniqueIds.size, 45);
});

test("enforces max limit cap at 50", async () => {
  let requestedLimit = 0;
  const searchRepo = {
    searchJobIds: async (_q: any, _c: any, limit: number) => {
      requestedLimit = limit;
      return { items: [], totalCount: 0 };
    }
  };
  const prisma = { job: { findMany: async () => [] } };
  const mockConfig = { cursorSigningSecret: TEST_SECRET };
  const service = new JobsService(prisma as never, searchRepo as never, mockConfig as never);

  await service.list({ limit: 100 });
  assert.equal(requestedLimit, 50);
});

test("getRelated returns explainable recommendations excluding the current job", async () => {
  const currentJob = mockJob("job-target", new Date(), "Senior Frontend Engineer");
  currentJob.slug = "senior-frontend-engineer";

  const related1 = mockJob("job-rel-1", new Date(), "Frontend React Developer");
  const related2 = mockJob("job-rel-2", new Date(), "Senior UI Engineer");

  const prisma = {
    job: {
      findUnique: async ({ where }: any) => {
        if (where.slug === "senior-frontend-engineer") return currentJob;
        return null;
      },
      findMany: async () => [related1, related2]
    }
  };

  const searchRepo = {
    findRelatedJobs: async (target: any, limit: number) => {
      assert.equal(target.id, "job-target");
      assert.equal(limit, 6);
      return ["job-rel-1", "job-rel-2"];
    }
  };

  const mockConfig = { cursorSigningSecret: TEST_SECRET };
  const service = new JobsService(prisma as never, searchRepo as never, mockConfig as never);
  const result = await service.getRelated("senior-frontend-engineer", 6);

  assert.equal(result.length, 2);
  assert.equal(result[0].id, "job-rel-1");
  assert.equal(result[1].id, "job-rel-2");
});

test("getRelated throws NotFoundException for non-existent slug", async () => {
  const prisma = { job: { findUnique: async () => null } };
  const searchRepo = { findRelatedJobs: async () => [] };
  const mockConfig = { cursorSigningSecret: TEST_SECRET };
  const service = new JobsService(prisma as never, searchRepo as never, mockConfig as never);

  await assert.rejects(
    () => service.getRelated("non-existent-job"),
    (err: any) => err instanceof NotFoundException
  );
});

test("correctly formats remote restrictions text without [object Object]", async () => {
  const job = mockJob("job-format", new Date(), "Staff Engineer");
  job.workMode = WorkMode.REMOTE;
  job.remoteScope = "COUNTRY_AND_TIMEZONE_LIMITED";
  job.remoteRestrictionLabels = ["Canada"];
  job.remoteTimezoneRestrictions = ["-8", "-7", "-6", "-5", "-3.5"];

  const searchRepo = {
    searchJobIds: async () => ({
      items: [{ id: "job-format" }],
      totalCount: 1
    })
  };
  const prisma = {
    job: { findMany: async () => [job] }
  };

  const mockConfig = { cursorSigningSecret: TEST_SECRET };
  const service = new JobsService(prisma as never, searchRepo as never, mockConfig as never);
  const res = await service.list({ limit: 1 });
  const formatted = res.data[0];

  assert.ok(formatted.remoteRestrictionsText);
  assert.match(formatted.remoteRestrictionsText, /Remote · Canada only · UTC-8 to UTC-3.5 overlap/);
  assert.doesNotMatch(formatted.remoteRestrictionsText, /\[object Object\]/);
});

test("list excludes full HTML description while getBySlug retains it", async () => {
  const publishedAt = new Date("2026-09-05T00:00:00.000Z");
  const job = mockJob("job-detail-test", publishedAt, "Full-stack Engineer");

  const searchRepo = {
    searchJobIds: async () => ({
      items: [{ id: "job-detail-test", sortVal1: publishedAt.toISOString(), sortVal2: publishedAt.toISOString() }],
      totalCount: 1
    }),
    findRelatedJobs: async () => [],
    getFacets: async () => ({})
  };

  const prisma = {
    job: {
      findMany: async () => [job],
      findUnique: async () => job
    }
  };

  const service = new JobsService(prisma as never, searchRepo as never, { cursorSigningSecret: TEST_SECRET } as never);
  const listResult = await service.list({ limit: 10 });
  assert.equal(listResult.data[0].descriptionHtml, null, "List response must exclude full descriptionHtml");
  assert.ok(listResult.data[0].excerpt);

  const detailResult = await service.getBySlug("job-detail-test");
  assert.ok(detailResult);
  assert.equal(detailResult.descriptionHtml, "<p>Build scalable web applications</p>", "Detail response must retain descriptionHtml");
});

function mockJob(id: string, publishedAt: Date, title = "Software Engineer") {
  return {
    id,
    slug: id,
    canonicalTitle: title,
    normalizedRole: null,
    seniority: "Senior",
    employmentType: "Full Time",
    descriptionText: "Build scalable web applications",
    descriptionHtml: "<p>Build scalable web applications</p>",
    workMode: WorkMode.REMOTE,
    remoteScope: "WORLDWIDE",
    remoteRestrictions: { scope: "WORLDWIDE", countries: [], labels: [], timezones: [] },
    remoteCountryCodes: [] as string[],
    remoteRestrictionLabels: [] as string[],
    remoteTimezoneRestrictions: [] as string[],
    requiredSkills: ["TypeScript", "Node.js"] as string[],
    preferredSkills: [] as string[],
    authorization: null,
    contentHash: "hash",
    status: JobStatus.ACTIVE,
    moderationState: "approved",
    sourceDisclosure: null,
    canonicalFingerprint: null,
    searchDocument: `${title} TypeScript Node.js`,
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
    companyId: "comp-1",
    sourceId: "src-1",
    primaryOccurrenceId: null,
    company: {
      id: "comp-1",
      slug: "acme",
      canonicalName: "Acme Corp",
      logoUrl: "https://example.com/logo.png"
    },
    source: {
      id: "src-1",
      slug: "himalayas",
      name: "Himalayas",
      baseUrl: "https://himalayas.app",
      attributionPolicy: "Attribution"
    },
    salaries: [
      {
        id: "sal-1",
        jobId: id,
        currency: "USD",
        min: 120000,
        max: 160000,
        period: "annual",
        source: "himalayas",
        ambiguity: "reported"
      }
    ],
    locations: [],
    providerRecords: [
      {
        providerId: "himalayas.guid",
        externalId: id,
        sourceUrl: "https://himalayas.app/jobs/" + id,
        applicationUrl: "https://himalayas.app/jobs/" + id,
        lastSeenAt: publishedAt
      }
    ]
  };
}
