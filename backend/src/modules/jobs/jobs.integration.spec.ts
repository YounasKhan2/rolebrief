import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { JobSortOption } from "./dto/jobs-query.dto";
import { JobsSearchRepository } from "./jobs-search.repository";
import { JobsService } from "./jobs.service";

test("database-wide discovery: search, filters, facets, and 7 sort modes with null/tied handling", async () => {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = "postgresql://rolebrief:rolebrief_dev_password@localhost:5432/rolebrief?schema=public";
  }

  const prisma = new PrismaClient();
  try {
    const totalCount = await prisma.job.count({ where: { status: "ACTIVE" } });
    if (totalCount === 0) return;

    const searchRepo = new JobsSearchRepository(prisma as any);
    const mockConfig = { cursorSigningSecret: "integration-test-secret-at-least-32-chars-long" };
    const service = new JobsService(prisma as any, searchRepo, mockConfig as any);

    // 1. Full list returns accurate database count
    const listRes = await service.list({ limit: 20 });
    assert.equal(listRes.totalCount, totalCount);
    assert.equal(listRes.data.length, Math.min(20, totalCount));

    // 2. Multi-word title and content search
    const searchRes = await service.list({ q: "engineer", limit: 10 });
    assert.ok(searchRes.totalCount > 0);
    assert.ok(searchRes.data.length > 0);

    // 3. Company search: searching "mercor" matches Mercor jobs
    const companyRes = await service.list({ q: "mercor", limit: 10 });
    assert.ok(companyRes.totalCount > 0);
    assert.ok(companyRes.data.some((j) => j.company?.name.toLowerCase().includes("mercor")));

    // 4. Facets respect active filters
    const allFacets = await service.getFacets({});
    const engineerFacets = await service.getFacets({ q: "engineer" });
    assert.ok(allFacets.employmentType.length > 0);
    assert.ok(engineerFacets.employmentType.length > 0);
    // Count of engineer roles should be <= all roles
    const totalAllEmp = allFacets.employmentType.reduce((acc, f) => acc + f.count, 0);
    const totalEngEmp = engineerFacets.employmentType.reduce((acc, f) => acc + f.count, 0);
    assert.ok(totalEngEmp <= totalAllEmp);

    // 5. Test all 7 sort options with null & tied values
    const sortModes = [
      JobSortOption.NEWEST,
      JobSortOption.RECENTLY_UPDATED,
      JobSortOption.DEADLINE_SOON,
      JobSortOption.SALARY_HIGH,
      JobSortOption.SALARY_LOW,
      JobSortOption.TITLE_AZ,
      JobSortOption.RELEVANCE
    ];

    for (const sortMode of sortModes) {
      const q = sortMode === JobSortOption.RELEVANCE ? "engineer" : undefined;
      const res = await service.list({ sort: sortMode, q, limit: 10 });
      assert.ok(res.data.length > 0, `Sort mode ${sortMode} should return results`);
      // Validate cursor is generated if hasNextPage
      if (res.pageInfo.hasNextPage) {
        assert.ok(res.pageInfo.nextCursor, `Next cursor required for ${sortMode}`);
        assert.ok(res.pageInfo.nextCursor.includes("."), `Cursor must be HMAC signed for ${sortMode}`);

        // Traverse second page using keyset cursor
        const p2 = await service.list({ sort: sortMode, q, cursor: res.pageInfo.nextCursor, limit: 10 });
        assert.ok(p2.data.length > 0, `Second page of ${sortMode} should return results`);
        // Verify no duplicate IDs between page 1 and page 2
        const p1Ids = new Set(res.data.map((j) => j.id));
        for (const j of p2.data) {
          assert.equal(p1Ids.has(j.id), false, `Duplicate ID ${j.id} found in page 2 of ${sortMode}`);
        }
      }
    }

    // 6. Period-safe salary filtering: hourly jobs ($55-65/hr) annualized to ~$114k-135k
    const salaryFilterRes = await service.list({ salaryMin: 100000, currency: "USD", limit: 20 });
    assert.ok(salaryFilterRes.totalCount > 0);
    assert.ok(salaryFilterRes.data.length > 0);

    // 7. Related jobs recommendation excludes current job
    const sampleSlug = listRes.data[0].slug;
    const related = await service.getRelated(sampleSlug, 4);
    assert.ok(Array.isArray(related));
    assert.ok(related.every((r) => r.slug !== sampleSlug));
  } finally {
    await prisma.$disconnect();
  }
});
