import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { NotFoundException } from "@nestjs/common";
import { SavedService } from "./saved.service";

function createMockPrisma(overrides: Record<string, any> = {}) {
  return {
    job: {
      findUnique: async () => null,
      findMany: async () => [],
      ...overrides.job
    },
    savedItem: {
      findMany: async () => [],
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

test("SavedService: getSavedJobs returns serialized jobs with savedAt and filters nulls", async () => {
  const now = new Date();
  const mockPrisma = createMockPrisma({
    savedItem: {
      findMany: async () => [
        {
          id: "si_1",
          userId: "user_1",
          itemType: "JOB",
          itemId: "job-1",
          createdAt: now,
          job: { id: "j_1", slug: "job-1", canonicalTitle: "Job 1", company: { name: "Acme" } }
        },
        {
          id: "si_2",
          userId: "user_1",
          itemType: "JOB",
          itemId: "job-deleted",
          createdAt: now,
          job: null // represents a job that was purged
        }
      ]
    }
  });

  const service = new SavedService(mockPrisma, createMockJobsService());
  const result = await service.getSavedJobs("user_1");

  assert.equal(result.totalCount, 1);
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].slug, "job-1");
  assert.equal(result.data[0].savedAt, now.toISOString());
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
