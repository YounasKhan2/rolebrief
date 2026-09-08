import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { SavedService } from "./saved.service";
import { JobSlugValidationPipe } from "./saved.controller";

function createMockPrisma(overrides: Record<string, any> = {}) {
  return {
    job: {
      findUnique: async () => null,
      findMany: async () => [],
      ...overrides.job
    },
    savedItem: {
      findMany: async () => [],
      count: async () => 0,
      upsert: async () => ({ id: "saved_1" }),
      deleteMany: async () => ({ count: 1 }),
      ...overrides.savedItem
    }
  } as any;
}

function createMockJobsService() {
  return {
    include: () => ({ company: true, source: true }),
    serialize: (job: any, _options: any) => ({
      id: job.id,
      slug: job.slug,
      title: job.canonicalTitle || job.title,
      company: job.company
    })
  } as any;
}

test("SavedService: getSavedJobSlugs returns array of slugs in order", async () => {
  const mockPrisma = createMockPrisma({
    savedItem: {
      findMany: async (args: any) => {
        assert.equal(args.where.userId, "user_1");
        assert.equal(args.where.itemType, "JOB");
        return [
          { itemId: "staff-platform-engineer" },
          { itemId: "senior-backend-engineer" }
        ];
      }
    }
  });

  const service = new SavedService(mockPrisma, createMockJobsService());
  const slugs = await service.getSavedJobSlugs("user_1");
  assert.deepEqual(slugs, ["staff-platform-engineer", "senior-backend-engineer"]);
});

test("SavedService: getSavedJobs returns serialized jobs with cursor pageInfo", async () => {
  const now = new Date();
  const mockPrisma = createMockPrisma({
    savedItem: {
      count: async (args: any) => {
        assert.equal(args.where.userId, "user_1");
        return 1;
      },
      findMany: async (args: any) => {
        assert.equal(args.where.userId, "user_1");
        return [
          {
            id: "si_1",
            userId: "user_1",
            itemType: "JOB",
            itemId: "job-1",
            createdAt: now,
            job: { id: "j_1", slug: "job-1", status: "ACTIVE", canonicalTitle: "Job 1", company: { name: "Acme" } }
          },
          {
            id: "si_2",
            userId: "user_1",
            itemType: "JOB",
            itemId: "job-deleted",
            createdAt: now,
            job: null
          }
        ];
      }
    }
  });

  const service = new SavedService(mockPrisma, createMockJobsService());
  const result = await service.getSavedJobs("user_1");

  assert.equal(result.totalCount, 1);
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].slug, "job-1");
  assert.equal(result.data[0].savedAt, now.toISOString());
  assert.equal(result.pageInfo.hasNextPage, false);
  assert.equal(result.pageInfo.nextCursor, null);
});

test("SavedService: cursor pagination returns correct nextCursor and hasNextPage", async () => {
  const now = new Date();
  const mockPrisma = createMockPrisma({
    savedItem: {
      count: async () => 3,
      findMany: async (args: any) => {
        assert.equal(args.take, 3); // limit 2 + 1
        return [
          {
            id: "si_1",
            userId: "user_1",
            itemType: "JOB",
            itemId: "job-1",
            createdAt: now,
            job: { id: "j_1", slug: "job-1", status: "ACTIVE", canonicalTitle: "Job 1" }
          },
          {
            id: "si_2",
            userId: "user_1",
            itemType: "JOB",
            itemId: "job-2",
            createdAt: now,
            job: { id: "j_2", slug: "job-2", status: "ACTIVE", canonicalTitle: "Job 2" }
          },
          {
            id: "si_3",
            userId: "user_1",
            itemType: "JOB",
            itemId: "job-3",
            createdAt: now,
            job: { id: "j_3", slug: "job-3", status: "ACTIVE", canonicalTitle: "Job 3" }
          }
        ];
      }
    }
  });

  const service = new SavedService(mockPrisma, createMockJobsService());
  const result = await service.getSavedJobs("user_1", { limit: 2 });

  assert.equal(result.totalCount, 3);
  assert.equal(result.data.length, 2);
  assert.equal(result.pageInfo.hasNextPage, true);
  assert.equal(result.pageInfo.nextCursor, "si_2");
});

test("SavedService: multi-user isolation ensures User A cannot read or delete User B's records", async () => {
  const user1Records = [
    {
      id: "si_u1_1",
      userId: "user_1",
      itemType: "JOB",
      itemId: "job-alpha",
      createdAt: new Date(),
      job: { id: "j_alpha", slug: "job-alpha", status: "ACTIVE", canonicalTitle: "Alpha" }
    }
  ];

  let deletedWhere: any = null;

  const mockPrisma = createMockPrisma({
    savedItem: {
      count: async (args: any) => {
        return args.where.userId === "user_1" ? user1Records.length : 0;
      },
      findMany: async (args: any) => {
        if (args.where.userId === "user_1") {
          return user1Records;
        }
        return []; // user_2 has no records in this check
      },
      deleteMany: async (args: any) => {
        deletedWhere = args.where;
        return { count: 0 }; // When user_2 attempts to delete User 1's job
      }
    }
  });

  const service = new SavedService(mockPrisma, createMockJobsService());

  // User 1 sees their record
  const u1Saved = await service.getSavedJobs("user_1");
  assert.equal(u1Saved.data.length, 1);
  assert.equal(u1Saved.data[0].slug, "job-alpha");

  // User 2 cannot see User 1's record
  const u2Saved = await service.getSavedJobs("user_2");
  assert.equal(u2Saved.data.length, 0);

  // User 2 attempts to unsave User 1's job
  await service.unsaveJob("user_2", "job-alpha");
  // Verification: delete query was strictly scoped to userId: user_2
  assert.equal(deletedWhere.userId, "user_2");
  assert.equal(deletedWhere.itemId, "job-alpha");
});

test("SavedService: preserved expired jobs retain status and flag", async () => {
  const past = new Date(Date.now() - 86400000);
  const mockPrisma = createMockPrisma({
    savedItem: {
      count: async () => 1,
      findMany: async () => [
        {
          id: "si_exp",
          userId: "user_1",
          itemType: "JOB",
          itemId: "job-expired",
          createdAt: new Date(),
          job: {
            id: "j_exp",
            slug: "job-expired",
            status: "EXPIRED",
            expiresAt: past,
            canonicalTitle: "Expired Role"
          }
        }
      ]
    }
  });

  const service = new SavedService(mockPrisma, createMockJobsService());
  const result = await service.getSavedJobs("user_1");

  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].status, "EXPIRED");
  assert.equal(result.data[0].isExpired, true);
});

test("SavedService: saveJob throws NotFoundException for nonexistent slug", async () => {
  const mockPrisma = createMockPrisma({
    job: {
      findUnique: async () => null
    }
  });

  const service = new SavedService(mockPrisma, createMockJobsService());
  await assert.rejects(
    () => service.saveJob("user_1", "non-existent-slug"),
    NotFoundException
  );
});

test("SavedService: saveJob upserts SavedItem idempotently", async () => {
  let upsertCalledWith: any = null;
  const mockPrisma = createMockPrisma({
    job: {
      findUnique: async () => ({ id: "job_db_123", slug: "real-job-slug" })
    },
    savedItem: {
      upsert: async (args: any) => {
        upsertCalledWith = args;
        return { id: "si_saved" };
      }
    }
  });

  const service = new SavedService(mockPrisma, createMockJobsService());
  const res = await service.saveJob("user_1", "real-job-slug");

  assert.deepEqual(res, { success: true, saved: true, slug: "real-job-slug" });
  assert.deepEqual(upsertCalledWith.where.userId_itemType_itemId, {
    userId: "user_1",
    itemType: "JOB",
    itemId: "real-job-slug"
  });
  assert.equal(upsertCalledWith.create.jobId, "job_db_123");
});

test("SavedService: unsaveJob deletes item idempotently", async () => {
  let deleteCalledWith: any = null;
  const mockPrisma = createMockPrisma({
    savedItem: {
      deleteMany: async (args: any) => {
        deleteCalledWith = args;
        return { count: 1 };
      }
    }
  });

  const service = new SavedService(mockPrisma, createMockJobsService());
  const res = await service.unsaveJob("user_1", "slug-to-remove");

  assert.deepEqual(res, { success: true, saved: false, slug: "slug-to-remove" });
  assert.deepEqual(deleteCalledWith.where, {
    userId: "user_1",
    itemType: "JOB",
    itemId: "slug-to-remove"
  });
});

test("JobSlugValidationPipe: accepts valid slugs and rejects invalid/path-traversal slugs", () => {
  const pipe = new JobSlugValidationPipe();

  // Valid
  assert.equal(pipe.transform("staff-software-engineer"), "staff-software-engineer");
  assert.equal(pipe.transform("job_123_abc"), "job_123_abc");
  assert.equal(pipe.transform("A1-B2_C3"), "A1-B2_C3");

  // Invalid: path traversal
  assert.throws(() => pipe.transform("../../../etc/passwd"), BadRequestException);
  assert.throws(() => pipe.transform("job/123"), BadRequestException);

  // Invalid: spaces or special chars
  assert.throws(() => pipe.transform("job 123"), BadRequestException);
  assert.throws(() => pipe.transform("job@role"), BadRequestException);
  assert.throws(() => pipe.transform(""), BadRequestException);

  // Invalid: exceeds 120 chars
  const longSlug = "a".repeat(121);
  assert.throws(() => pipe.transform(longSlug), BadRequestException);
});
