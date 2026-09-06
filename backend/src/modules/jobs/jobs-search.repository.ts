import { Injectable } from "@nestjs/common";
import { JobStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { JobSortOption, JobsQueryDto } from "./dto/jobs-query.dto";
import { KeysetCursorPayload } from "./jobs-cursor.util";

export interface SearchResultItem {
  id: string;
  rank?: number;
  sortVal1?: string | number | null;
  sortVal2?: string | number | null;
  sortVal3?: string | number | null;
}

export interface FacetCount {
  value: string;
  label: string;
  count: number;
}

export interface JobFacetsResult {
  workMode: FacetCount[];
  remoteScope: FacetCount[];
  seniority: FacetCount[];
  employmentType: FacetCount[];
  country: FacetCount[];
  category: FacetCount[];
  provider: FacetCount[];
}

@Injectable()
export class JobsSearchRepository {
  constructor(private readonly prisma: PrismaService) {}

  async searchJobIds(
    query: JobsQueryDto,
    cursorPayload: KeysetCursorPayload | null,
    limit: number
  ): Promise<{ items: SearchResultItem[]; totalCount: number }> {
    const sort = query.sort || (query.q ? JobSortOption.RELEVANCE : JobSortOption.NEWEST);
    const take = Math.min(Math.max(limit, 1), 50);

    const { whereSql, params, ftsQuery } = this.buildWhereClause(query);

    // Build the keyset cursor WHERE clause if present
    let cursorSql = "";
    if (cursorPayload) {
      cursorSql = this.buildCursorCondition(sort, cursorPayload, params, query, ftsQuery);
    }

    const fullWhereSql = cursorSql
      ? `${whereSql} AND (${cursorSql})`
      : whereSql;

    const { selectScoreSql, orderBySql } = this.buildOrderClause(sort, ftsQuery, query);

    // Query 1: Total count for this normalized query (without cursor condition)
    const countQuery = `
      SELECT COUNT(DISTINCT j.id)::int AS "totalCount"
      FROM "Job" j
      LEFT JOIN "Company" c ON j."companyId" = c.id
      ${whereSql}
    `;

    // Query 2: Page of IDs with sort values
    const dataQuery = `
      SELECT DISTINCT
        j.id,
        ${selectScoreSql}
      FROM "Job" j
      LEFT JOIN "Company" c ON j."companyId" = c.id
      ${fullWhereSql}
      ORDER BY ${orderBySql}
      LIMIT ${take + 1}
    `;

    const [countResult, rows] = await Promise.all([
      this.prisma.$queryRawUnsafe<{ totalCount: number }[]>(countQuery, ...params),
      this.prisma.$queryRawUnsafe<any[]>(dataQuery, ...params)
    ]);

    const totalCount = countResult[0]?.totalCount ?? 0;
    const items: SearchResultItem[] = rows.map((r) => ({
      id: r.id,
      rank: r.rank !== undefined ? Number(r.rank) : undefined,
      sortVal1: r.sort_val_1 !== undefined ? r.sort_val_1 : undefined,
      sortVal2: r.sort_val_2 !== undefined ? r.sort_val_2 : undefined,
      sortVal3: r.sort_val_3 !== undefined ? r.sort_val_3 : undefined
    }));

    return { items, totalCount };
  }

  async getFacets(query: Partial<JobsQueryDto>): Promise<JobFacetsResult> {
    const { whereSql, params } = this.buildWhereClause(query, { ignoreStatus: false });
    const andWhere = whereSql ? `${whereSql} AND` : "WHERE";

    const workModeSql = `
      SELECT j."workMode"::text AS val, count(*)::int AS cnt
      FROM "Job" j
      LEFT JOIN "Company" c ON j."companyId" = c.id
      ${whereSql}
      GROUP BY j."workMode"
      ORDER BY cnt DESC
    `;

    const remoteScopeSql = `
      SELECT coalesce(j."remoteScope", 'UNKNOWN') AS val, count(*)::int AS cnt
      FROM "Job" j
      LEFT JOIN "Company" c ON j."companyId" = c.id
      ${whereSql}
      GROUP BY j."remoteScope"
      ORDER BY cnt DESC
    `;

    const employmentTypeSql = `
      SELECT coalesce(j."employmentType", 'Other') AS val, count(*)::int AS cnt
      FROM "Job" j
      LEFT JOIN "Company" c ON j."companyId" = c.id
      ${whereSql}
      GROUP BY j."employmentType"
      ORDER BY cnt DESC
    `;

    const senioritySql = `
      SELECT unnest(string_to_array(j.seniority, ', ')) AS val, count(*)::int AS cnt
      FROM "Job" j
      LEFT JOIN "Company" c ON j."companyId" = c.id
      ${andWhere} j.seniority IS NOT NULL
      GROUP BY val
      ORDER BY cnt DESC
    `;

    const countrySql = `
      SELECT unnest(j."remoteCountryCodes") AS val, count(*)::int AS cnt
      FROM "Job" j
      LEFT JOIN "Company" c ON j."companyId" = c.id
      ${andWhere} array_length(j."remoteCountryCodes", 1) > 0
      GROUP BY val
      ORDER BY cnt DESC
      LIMIT 20
    `;

    const categorySql = `
      SELECT unnest(j."requiredSkills") AS val, count(*)::int AS cnt
      FROM "Job" j
      LEFT JOIN "Company" c ON j."companyId" = c.id
      ${andWhere} array_length(j."requiredSkills", 1) > 0
      GROUP BY val
      ORDER BY cnt DESC
      LIMIT 30
    `;

    const providerSql = `
      SELECT pr."providerId" AS val, count(DISTINCT j.id)::int AS cnt
      FROM "Job" j
      JOIN "ProviderRecord" pr ON pr."jobId" = j.id
      LEFT JOIN "Company" c ON j."companyId" = c.id
      ${whereSql}
      GROUP BY pr."providerId"
      ORDER BY cnt DESC
    `;

    const [
      workModes,
      remoteScopes,
      employmentTypes,
      seniorities,
      countries,
      categories,
      providers
    ] = await Promise.all([
      this.prisma.$queryRawUnsafe<{ val: string; cnt: number }[]>(workModeSql, ...params).catch(() => []),
      this.prisma.$queryRawUnsafe<{ val: string; cnt: number }[]>(remoteScopeSql, ...params).catch(() => []),
      this.prisma.$queryRawUnsafe<{ val: string; cnt: number }[]>(employmentTypeSql, ...params).catch(() => []),
      this.prisma.$queryRawUnsafe<{ val: string; cnt: number }[]>(senioritySql, ...params).catch(() => []),
      this.prisma.$queryRawUnsafe<{ val: string; cnt: number }[]>(countrySql, ...params).catch(() => []),
      this.prisma.$queryRawUnsafe<{ val: string; cnt: number }[]>(categorySql, ...params).catch(() => []),
      this.prisma.$queryRawUnsafe<{ val: string; cnt: number }[]>(providerSql, ...params).catch(() => [])
    ]);

    return {
      workMode: workModes.map((r) => ({ value: r.val, label: formatLabel(r.val), count: Number(r.cnt) })),
      remoteScope: remoteScopes.map((r) => ({ value: r.val, label: formatLabel(r.val), count: Number(r.cnt) })),
      employmentType: employmentTypes.map((r) => ({ value: r.val, label: r.val, count: Number(r.cnt) })),
      seniority: seniorities.map((r) => ({ value: r.val, label: r.val, count: Number(r.cnt) })),
      country: countries.map((r) => ({ value: r.val, label: r.val, count: Number(r.cnt) })),
      category: categories.map((r) => ({ value: r.val, label: r.val, count: Number(r.cnt) })),
      provider: providers.map((r) => ({ value: r.val, label: r.val, count: Number(r.cnt) }))
    };
  }

  async findRelatedJobs(
    targetJob: {
      id: string;
      slug: string;
      canonicalTitle: string;
      seniority: string | null;
      workMode: string;
      remoteScope: string | null;
      requiredSkills: string[];
      companyId: string | null;
    },
    limit = 6
  ): Promise<string[]> {
    const take = Math.min(Math.max(limit, 1), 20);

    const relatedQuery = `
      SELECT
        j.id,
        (
          -- Skills overlap score (up to 5.0)
          coalesce((
            SELECT count(*)::float * 1.5
            FROM unnest(j."requiredSkills") s
            WHERE s = ANY($2::text[])
          ), 0.0)
          +
          -- Seniority match (2.0)
          CASE WHEN $3::text IS NOT NULL AND j.seniority ILIKE '%' || $3 || '%' THEN 2.0 ELSE 0.0 END
          +
          -- Work mode match (1.5)
          CASE WHEN j."workMode"::text = $4::text THEN 1.5 ELSE 0.0 END
          +
          -- Same company match (1.0)
          CASE WHEN $5::text IS NOT NULL AND j."companyId" = $5 THEN 1.0 ELSE 0.0 END
          +
          -- Title similarity via trigram (up to 3.0)
          (similarity(j."canonicalTitle", $6::text) * 3.0)
        ) AS relevance
      FROM "Job" j
      WHERE
        j.id != $1
        AND j.status::text = 'ACTIVE'
      ORDER BY relevance DESC, j."publishedAt" DESC NULLS LAST, j.id DESC
      LIMIT ${take}
    `;

    const rows = await this.prisma.$queryRawUnsafe<{ id: string; relevance: number }[]>(
      relatedQuery,
      targetJob.id,
      targetJob.requiredSkills || [],
      targetJob.seniority || null,
      targetJob.workMode,
      targetJob.companyId || null,
      targetJob.canonicalTitle
    );

    return rows.map((r) => r.id);
  }

  private buildWhereClause(
    query: Partial<JobsQueryDto>,
    options: { ignoreStatus?: boolean } = {}
  ): { whereSql: string; params: any[]; ftsQuery: string | null } {
    const conditions: string[] = [];
    const params: any[] = [];

    // Status: default to ACTIVE unless specified
    if (!options.ignoreStatus) {
      const status = query.status || JobStatus.ACTIVE;
      params.push(status);
      conditions.push(`j.status::text = $${params.length}`);
    }

    // Full-Text Search (q)
    let ftsQuery: string | null = null;
    if (query.q && query.q.trim()) {
      const cleanedQuery = cleanSearchQuery(query.q);
      if (cleanedQuery) {
        ftsQuery = cleanedQuery;
        params.push(cleanedQuery);
        const qIdx = params.length;

        // FTS condition: match against weighted tsvector OR trigram similarity for title/company
        conditions.push(`
          (
            to_tsvector('english', coalesce(j."canonicalTitle", '') || ' ' || coalesce(j."searchDocument", '') || ' ' || coalesce(j."descriptionText", ''))
            @@ websearch_to_tsquery('english', $${qIdx})
            OR j."canonicalTitle" % $${qIdx}
            OR c."canonicalName" % $${qIdx}
          )
        `);
      }
    }

    // Work Mode (OR within group)
    if (query.workMode && query.workMode.length > 0) {
      params.push(query.workMode);
      conditions.push(`j."workMode"::text = ANY($${params.length}::text[])`);
    }

    // Remote Scope (OR within group)
    if (query.remoteScope && query.remoteScope.length > 0) {
      params.push(query.remoteScope);
      conditions.push(`j."remoteScope" = ANY($${params.length}::text[])`);
    }

    // Employment Type (OR within group)
    if (query.employmentType && query.employmentType.length > 0) {
      params.push(query.employmentType);
      conditions.push(`j."employmentType" = ANY($${params.length}::text[])`);
    }

    // Seniority (OR within group, substring match because seniorities can be composite)
    if (query.seniority && query.seniority.length > 0) {
      const seniorityClauses = query.seniority.map((s) => {
        params.push(`%${s}%`);
        return `j.seniority ILIKE $${params.length}`;
      });
      conditions.push(`(${seniorityClauses.join(" OR ")})`);
    }

    // Company (slug or name)
    if (query.company && query.company.length > 0) {
      params.push(query.company);
      const cIdx = params.length;
      conditions.push(`(c.slug = ANY($${cIdx}::text[]) OR c."canonicalName" = ANY($${cIdx}::text[]))`);
    }

    // Country (alpha2, name, or label)
    if (query.country && query.country.length > 0) {
      params.push(query.country);
      const countryIdx = params.length;
      conditions.push(`
        (
          j."remoteCountryCodes" && $${countryIdx}::text[]
          OR j."remoteRestrictionLabels" && $${countryIdx}::text[]
          OR EXISTS (
            SELECT 1 FROM "JobLocation" jl
            JOIN "Location" loc ON jl."locationId" = loc.id
            WHERE jl."jobId" = j.id AND (loc.alpha2 = ANY($${countryIdx}::text[]) OR loc.name = ANY($${countryIdx}::text[]))
          )
        )
      `);
    }

    // Timezone
    if (query.timezone && query.timezone.length > 0) {
      params.push(query.timezone);
      conditions.push(`j."remoteTimezoneRestrictions" && $${params.length}::text[]`);
    }

    // Category / Skills
    if (query.category && query.category.length > 0) {
      params.push(query.category);
      conditions.push(`j."requiredSkills" && $${params.length}::text[]`);
    }

    // Salary: Currency and Period-Safe Filtering
    if (
      query.salaryMin !== undefined ||
      query.salaryMax !== undefined ||
      query.currency ||
      query.salaryPeriod
    ) {
      const salConditions: string[] = ['s."jobId" = j.id'];

      // Never compare across currencies without currency alignment (defaults to USD if unspecified)
      const targetCurrency = (query.currency || "USD").toUpperCase();
      params.push(targetCurrency);
      salConditions.push(`s.currency = $${params.length}`);

      if (query.salaryPeriod) {
        params.push(query.salaryPeriod.toLowerCase());
        salConditions.push(`lower(coalesce(s.period, 'annual')) = $${params.length}`);
        if (query.salaryMin !== undefined) {
          params.push(query.salaryMin);
          salConditions.push(`(s.max >= $${params.length} OR (s.max IS NULL AND s.min >= $${params.length}))`);
        }
        if (query.salaryMax !== undefined) {
          params.push(query.salaryMax);
          salConditions.push(`(s.min <= $${params.length} OR (s.min IS NULL AND s.max <= $${params.length}))`);
        }
      } else {
        // Period-normalized annualized equivalence (never compare hourly raw with annual raw)
        const mult = `CASE lower(coalesce(s.period, 'annual'))
          WHEN 'annual' THEN 1.0
          WHEN 'monthly' THEN 12.0
          WHEN 'fortnightly' THEN 26.0
          WHEN 'weekly' THEN 52.0
          WHEN 'hourly' THEN 2080.0
          ELSE 1.0
        END`;

        if (query.salaryMin !== undefined) {
          params.push(query.salaryMin);
          salConditions.push(`(coalesce(s.max, s.min) * ${mult}) >= $${params.length}`);
        }
        if (query.salaryMax !== undefined) {
          params.push(query.salaryMax);
          salConditions.push(`(coalesce(s.min, s.max) * ${mult}) <= $${params.length}`);
        }
      }

      conditions.push(`EXISTS (SELECT 1 FROM "Salary" s WHERE ${salConditions.join(" AND ")})`);
    }

    // Published After
    if (query.publishedAfter) {
      params.push(new Date(query.publishedAfter));
      conditions.push(`j."publishedAt" >= $${params.length}`);
    }

    // Deadline Before (genuine application deadline only)
    if (query.deadlineBefore) {
      params.push(new Date(query.deadlineBefore));
      conditions.push(`j."applicationDeadlineAt" IS NOT NULL AND j."applicationDeadlineAt" <= $${params.length}`);
    }

    // Provider
    if (query.provider) {
      params.push(query.provider);
      params.push(`${query.provider}%`);
      conditions.push(`EXISTS (SELECT 1 FROM "ProviderRecord" pr WHERE pr."jobId" = j.id AND (pr."providerId" = $${params.length - 1} OR pr."providerId" ILIKE $${params.length}))`);
    }

    // Exclusions
    if (query.excludeCategory && query.excludeCategory.length > 0) {
      params.push(query.excludeCategory);
      conditions.push(`NOT (j."requiredSkills" && $${params.length}::text[])`);
    }
    if (query.excludeWorkMode && query.excludeWorkMode.length > 0) {
      params.push(query.excludeWorkMode);
      conditions.push(`NOT (j."workMode"::text = ANY($${params.length}::text[]))`);
    }
    if (query.excludeSeniority && query.excludeSeniority.length > 0) {
      const excludeClauses = query.excludeSeniority.map((s) => {
        params.push(`%${s}%`);
        return `j.seniority ILIKE $${params.length}`;
      });
      conditions.push(`NOT (${excludeClauses.join(" OR ")})`);
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    return { whereSql, params, ftsQuery };
  }

  private buildOrderClause(
    sort: JobSortOption,
    ftsQuery: string | null,
    query: Partial<JobsQueryDto>
  ): { selectScoreSql: string; orderBySql: string } {
    switch (sort) {
      case JobSortOption.RELEVANCE: {
        const rankExpression = this.getRankExpression(ftsQuery);
        return {
          selectScoreSql: `${rankExpression} AS sort_val_1, j."publishedAt" AS sort_val_2, j."discoveredAt" AS sort_val_3, ${rankExpression} AS rank`,
          orderBySql: `sort_val_1 DESC, j."publishedAt" DESC NULLS LAST, j."discoveredAt" DESC, j.id DESC`
        };
      }
      case JobSortOption.RECENTLY_UPDATED:
        return {
          selectScoreSql: `j."updatedAt" AS sort_val_1, NULL AS sort_val_2, NULL AS sort_val_3`,
          orderBySql: `j."updatedAt" DESC, j.id DESC`
        };
      case JobSortOption.DEADLINE_SOON:
        return {
          selectScoreSql: `j."applicationDeadlineAt" AS sort_val_1, j."publishedAt" AS sort_val_2, j."discoveredAt" AS sort_val_3`,
          orderBySql: `j."applicationDeadlineAt" ASC NULLS LAST, j."publishedAt" DESC NULLS LAST, j."discoveredAt" DESC, j.id DESC`
        };
      case JobSortOption.SALARY_HIGH: {
        const targetCurrency = (query.currency || "USD").replace(/[^A-Z]/g, "");
        const annualizedExpr = `(
          SELECT max(
            coalesce(s.max, s.min) * CASE lower(coalesce(s.period, 'annual'))
              WHEN 'annual' THEN 1.0
              WHEN 'monthly' THEN 12.0
              WHEN 'fortnightly' THEN 26.0
              WHEN 'weekly' THEN 52.0
              WHEN 'hourly' THEN 2080.0
              ELSE 1.0
            END
          )
          FROM "Salary" s
          WHERE s."jobId" = j.id AND s.currency = '${targetCurrency}'
        )`;
        return {
          selectScoreSql: `
            ${annualizedExpr} AS sort_val_1,
            j."publishedAt" AS sort_val_2,
            j."discoveredAt" AS sort_val_3
          `,
          orderBySql: `sort_val_1 DESC NULLS LAST, j."publishedAt" DESC NULLS LAST, j."discoveredAt" DESC, j.id DESC`
        };
      }
      case JobSortOption.SALARY_LOW: {
        const targetCurrency = (query.currency || "USD").replace(/[^A-Z]/g, "");
        const annualizedExpr = `(
          SELECT min(
            coalesce(s.min, s.max) * CASE lower(coalesce(s.period, 'annual'))
              WHEN 'annual' THEN 1.0
              WHEN 'monthly' THEN 12.0
              WHEN 'fortnightly' THEN 26.0
              WHEN 'weekly' THEN 52.0
              WHEN 'hourly' THEN 2080.0
              ELSE 1.0
            END
          )
          FROM "Salary" s
          WHERE s."jobId" = j.id AND s.currency = '${targetCurrency}'
        )`;
        return {
          selectScoreSql: `
            ${annualizedExpr} AS sort_val_1,
            j."publishedAt" AS sort_val_2,
            j."discoveredAt" AS sort_val_3
          `,
          orderBySql: `sort_val_1 ASC NULLS LAST, j."publishedAt" DESC NULLS LAST, j."discoveredAt" DESC, j.id DESC`
        };
      }
      case JobSortOption.TITLE_AZ:
        return {
          selectScoreSql: `j."canonicalTitle" AS sort_val_1, NULL AS sort_val_2, NULL AS sort_val_3`,
          orderBySql: `j."canonicalTitle" ASC, j.id ASC`
        };
      case JobSortOption.NEWEST:
      default:
        return {
          selectScoreSql: `j."publishedAt" AS sort_val_1, j."discoveredAt" AS sort_val_2, NULL AS sort_val_3`,
          orderBySql: `j."publishedAt" DESC NULLS LAST, j."discoveredAt" DESC, j.id DESC`
        };
    }
  }

  private getRankExpression(ftsQuery: string | null): string {
    return ftsQuery
      ? `(
          ts_rank_cd(
            setweight(to_tsvector('english', coalesce(j."canonicalTitle", '')), 'A') ||
            setweight(to_tsvector('english', coalesce(c."canonicalName", '')), 'B') ||
            setweight(to_tsvector('english', coalesce(j."searchDocument", '')), 'C') ||
            setweight(to_tsvector('english', coalesce(j."descriptionText", '')), 'D'),
            websearch_to_tsquery('english', '${ftsQuery.replace(/'/g, "''")}')
          ) * 3.0 +
          similarity(j."canonicalTitle", '${ftsQuery.replace(/'/g, "''")}') * 2.0
        )`
      : "0.0";
  }

  private buildSecondaryTimestampCursor(
    pubAt: Date | null,
    discAt: Date,
    params: any[],
    idIdx: number
  ): string {
    params.push(discAt);
    const discIdx = params.length;

    if (pubAt) {
      params.push(pubAt);
      const pubIdx = params.length;
      return `(
        j."publishedAt" < $${pubIdx}
        OR (j."publishedAt" = $${pubIdx} AND j."discoveredAt" < $${discIdx})
        OR (j."publishedAt" = $${pubIdx} AND j."discoveredAt" = $${discIdx} AND j.id < $${idIdx})
        OR j."publishedAt" IS NULL
      )`;
    }
    return `(
      j."publishedAt" IS NULL
      AND (j."discoveredAt" < $${discIdx} OR (j."discoveredAt" = $${discIdx} AND j.id < $${idIdx}))
    )`;
  }

  private buildCursorCondition(
    sort: JobSortOption,
    cursor: KeysetCursorPayload,
    params: any[],
    query: Partial<JobsQueryDto>,
    ftsQuery: string | null = null
  ): string {
    params.push(cursor.id);
    const idIdx = params.length;

    switch (sort) {
      case JobSortOption.RELEVANCE: {
        const rank = cursor.val[0] !== null && cursor.val[0] !== undefined ? Number(cursor.val[0]) : 0;
        const pubAt = cursor.val[1] ? new Date(String(cursor.val[1])) : null;
        const discAt = cursor.val[2] ? new Date(String(cursor.val[2])) : new Date(0);
        const rankExpr = this.getRankExpression(ftsQuery);
        params.push(rank);
        const rankIdx = params.length;
        const secCondition = this.buildSecondaryTimestampCursor(pubAt, discAt, params, idIdx);

        return `(${rankExpr} < $${rankIdx} OR (${rankExpr} = $${rankIdx} AND ${secCondition}))`;
      }
      case JobSortOption.RECENTLY_UPDATED: {
        const updAt = cursor.val[0] ? new Date(String(cursor.val[0])) : new Date(0);
        params.push(updAt);
        const updIdx = params.length;
        return `(j."updatedAt" < $${updIdx} OR (j."updatedAt" = $${updIdx} AND j.id < $${idIdx}))`;
      }
      case JobSortOption.DEADLINE_SOON: {
        const deadAt = cursor.val[0] ? new Date(String(cursor.val[0])) : null;
        const pubAt = cursor.val[1] ? new Date(String(cursor.val[1])) : null;
        const discAt = cursor.val[2] ? new Date(String(cursor.val[2])) : new Date(0);
        const secCondition = this.buildSecondaryTimestampCursor(pubAt, discAt, params, idIdx);

        if (deadAt) {
          params.push(deadAt);
          const deadIdx = params.length;
          return `(
            j."applicationDeadlineAt" > $${deadIdx}
            OR (j."applicationDeadlineAt" = $${deadIdx} AND ${secCondition})
            OR j."applicationDeadlineAt" IS NULL
          )`;
        }
        return `(
          j."applicationDeadlineAt" IS NULL
          AND ${secCondition}
        )`;
      }
      case JobSortOption.SALARY_HIGH: {
        const targetCurrency = (query.currency || "USD").replace(/[^A-Z]/g, "");
        const maxVal = cursor.val[0] !== null && cursor.val[0] !== undefined ? Number(cursor.val[0]) : null;
        const pubAt = cursor.val[1] ? new Date(String(cursor.val[1])) : null;
        const discAt = cursor.val[2] ? new Date(String(cursor.val[2])) : new Date(0);
        const secCondition = this.buildSecondaryTimestampCursor(pubAt, discAt, params, idIdx);

        const annualizedExpr = `(
          SELECT max(
            coalesce(s.max, s.min) * CASE lower(coalesce(s.period, 'annual'))
              WHEN 'annual' THEN 1.0
              WHEN 'monthly' THEN 12.0
              WHEN 'fortnightly' THEN 26.0
              WHEN 'weekly' THEN 52.0
              WHEN 'hourly' THEN 2080.0
              ELSE 1.0
            END
          )
          FROM "Salary" s
          WHERE s."jobId" = j.id AND s.currency = '${targetCurrency}'
        )`;

        if (maxVal !== null) {
          params.push(maxVal);
          const maxIdx = params.length;
          return `(
            ${annualizedExpr} < $${maxIdx}
            OR (
              ${annualizedExpr} = $${maxIdx}
              AND ${secCondition}
            )
            OR ${annualizedExpr} IS NULL
          )`;
        }
        return `(
          ${annualizedExpr} IS NULL
          AND ${secCondition}
        )`;
      }
      case JobSortOption.SALARY_LOW: {
        const targetCurrency = (query.currency || "USD").replace(/[^A-Z]/g, "");
        const minVal = cursor.val[0] !== null && cursor.val[0] !== undefined ? Number(cursor.val[0]) : null;
        const pubAt = cursor.val[1] ? new Date(String(cursor.val[1])) : null;
        const discAt = cursor.val[2] ? new Date(String(cursor.val[2])) : new Date(0);
        const secCondition = this.buildSecondaryTimestampCursor(pubAt, discAt, params, idIdx);

        const annualizedExpr = `(
          SELECT min(
            coalesce(s.min, s.max) * CASE lower(coalesce(s.period, 'annual'))
              WHEN 'annual' THEN 1.0
              WHEN 'monthly' THEN 12.0
              WHEN 'fortnightly' THEN 26.0
              WHEN 'weekly' THEN 52.0
              WHEN 'hourly' THEN 2080.0
              ELSE 1.0
            END
          )
          FROM "Salary" s
          WHERE s."jobId" = j.id AND s.currency = '${targetCurrency}'
        )`;

        if (minVal !== null) {
          params.push(minVal);
          const minIdx = params.length;
          return `(
            ${annualizedExpr} > $${minIdx}
            OR (
              ${annualizedExpr} = $${minIdx}
              AND ${secCondition}
            )
            OR ${annualizedExpr} IS NULL
          )`;
        }
        return `(
          ${annualizedExpr} IS NULL
          AND ${secCondition}
        )`;
      }
      case JobSortOption.TITLE_AZ: {
        const titleVal = cursor.val[0] ? String(cursor.val[0]) : "";
        params.push(titleVal);
        const titleIdx = params.length;
        return `(j."canonicalTitle" > $${titleIdx} OR (j."canonicalTitle" = $${titleIdx} AND j.id > $${idIdx}))`;
      }
      case JobSortOption.NEWEST:
      default: {
        const pubAt = cursor.val[0] ? new Date(String(cursor.val[0])) : null;
        const discAt = cursor.val[1] ? new Date(String(cursor.val[1])) : new Date(0);
        return this.buildSecondaryTimestampCursor(pubAt, discAt, params, idIdx);
      }
    }
  }
}

function cleanSearchQuery(q: string): string {
  return q
    .replace(/[^a-zA-Z0-9\s-_+]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatLabel(value: string): string {
  if (!value) return "Unknown";
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
