import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { RadarFeedQueryDto } from "./dto/radar-feed-query.dto";
import { RadarCandidate, RADAR_SQL_CANDIDATE_LIMIT } from "./radar.types";

@Injectable()
export class RadarQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async profileSnapshot(userId: string) {
    return this.prisma.candidateProfile.findUnique({
      where: { userId },
      include: { preferences: true }
    });
  }

  async generateCandidates(userId: string, query: RadarFeedQueryDto, snapshotAsOf: Date): Promise<RadarCandidate[]> {
    const sevenDaysAgo = new Date(snapshotAsOf.getTime() - 7 * 24 * 60 * 60 * 1000);
    const whereParts: Prisma.Sql[] = [
      Prisma.sql`j."status" = 'ACTIVE'`,
      Prisma.sql`j."firstSeenAt" <= ${snapshotAsOf}`
    ];

    if (query.freshnessWindow === "seven_days") {
      whereParts.push(Prisma.sql`j."firstSeenAt" >= ${sevenDaysAgo}`);
    }
    if (query.workMode?.length) {
      whereParts.push(Prisma.sql`j."workMode"::text = ANY(${query.workMode.map((v) => v.toUpperCase())})`);
    }
    if (query.employmentType?.length) {
      whereParts.push(Prisma.sql`LOWER(COALESCE(j."employmentType", '')) = ANY(${query.employmentType.map((v) => v.toLowerCase())})`);
    }
    if (query.country?.length) {
      const countries = query.country.map((v) => v.toUpperCase());
      whereParts.push(Prisma.sql`(
        j."remoteCountryCodes" && ${countries}::text[]
        OR EXISTS (
          SELECT 1
          FROM "JobLocation" jl
          JOIN "Location" l ON l."id" = jl."locationId"
          WHERE jl."jobId" = j."id" AND UPPER(COALESCE(l."alpha2", '')) = ANY(${countries})
        )
      )`);
    }
    if (query.provider?.length) {
      whereParts.push(Prisma.sql`EXISTS (
        SELECT 1 FROM "ProviderRecord" pr
        WHERE pr."jobId" = j."id" AND LOWER(pr."providerId") = ANY(${query.provider.map((v) => v.toLowerCase())})
      )`);
    }
    if (query.salaryDisclosed === true || query.salaryDisclosed === "true") {
      whereParts.push(Prisma.sql`EXISTS (
        SELECT 1 FROM "Salary" s
        WHERE s."jobId" = j."id" AND (s."min" IS NOT NULL OR s."max" IS NOT NULL)
      )`);
    }
    if (query.tracked === "exclude") {
      whereParts.push(Prisma.sql`NOT EXISTS (
        SELECT 1 FROM "Application" a
        WHERE a."userId" = ${userId} AND a."lifecycle" = 'ACTIVE' AND (a."jobId" = j."id" OR a."jobSlug" = j."slug")
      )`);
    } else if (query.tracked === "only") {
      whereParts.push(Prisma.sql`EXISTS (
        SELECT 1 FROM "Application" a
        WHERE a."userId" = ${userId} AND a."lifecycle" = 'ACTIVE' AND (a."jobId" = j."id" OR a."jobSlug" = j."slug")
      )`);
    }

    const whereSql = Prisma.join(whereParts, " AND ");
    const rows = await this.prisma.$queryRaw<Array<{
      id: string;
      slug: string;
      title: string;
      status: string;
      workMode: string | null;
      employmentType: string | null;
      seniority: string | null;
      firstSeenAt: Date;
      publishedAt: Date | null;
      applicationDeadlineAt: Date | null;
      applicationUrl: string | null;
      companyName: string | null;
      cheapRank: number;
    }>>`
      SELECT
        j."id",
        j."slug",
        j."canonicalTitle" AS "title",
        j."status"::text AS "status",
        j."workMode"::text AS "workMode",
        j."employmentType",
        j."seniority",
        j."firstSeenAt",
        j."publishedAt",
        j."applicationDeadlineAt",
        COALESCE(
          (SELECT pr."applicationUrl" FROM "ProviderRecord" pr WHERE pr."jobId" = j."id" ORDER BY pr."lastSeenAt" DESC LIMIT 1),
          (SELECT pr."sourceUrl" FROM "ProviderRecord" pr WHERE pr."jobId" = j."id" ORDER BY pr."lastSeenAt" DESC LIMIT 1)
        ) AS "applicationUrl",
        c."canonicalName" AS "companyName",
        (
          CASE WHEN COALESCE(
            (SELECT pr."applicationUrl" FROM "ProviderRecord" pr WHERE pr."jobId" = j."id" ORDER BY pr."lastSeenAt" DESC LIMIT 1),
            (SELECT pr."sourceUrl" FROM "ProviderRecord" pr WHERE pr."jobId" = j."id" ORDER BY pr."lastSeenAt" DESC LIMIT 1)
          ) IS NOT NULL THEN 0 ELSE 20 END
          + CASE WHEN j."publishedAt" IS NOT NULL THEN 0 ELSE 5 END
          + LEAST(30, GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (${snapshotAsOf} - COALESCE(j."publishedAt", j."firstSeenAt"))) / 86400)))::int
        ) AS "cheapRank"
      FROM "Job" j
      LEFT JOIN "Company" c ON c."id" = j."companyId"
      WHERE ${whereSql}
      ORDER BY "cheapRank" ASC, COALESCE(j."publishedAt", j."firstSeenAt") DESC, j."id" DESC
      LIMIT ${RADAR_SQL_CANDIDATE_LIMIT}
    `;

    return rows.map((row) => ({
      ...row,
      laneReasons: this.reasonCodes(row, sevenDaysAgo)
    }));
  }

  private reasonCodes(row: { applicationUrl: string | null; firstSeenAt: Date; publishedAt: Date | null }, sevenDaysAgo: Date) {
    const reasons = ["RADAR_DATABASE_CANDIDATE"];
    if (row.applicationUrl) reasons.push("JOB_APPLY_AVAILABLE");
    if (row.firstSeenAt >= sevenDaysAgo) reasons.push("JOB_FIRST_SEEN_WITHIN_7_DAYS");
    if (row.publishedAt) reasons.push("PROVIDER_PUBLISHED_TIMESTAMP");
    return reasons;
  }
}
