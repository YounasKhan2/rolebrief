import { Injectable } from "@nestjs/common";
import { JobStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(cursor?: string, limit = 20) {
    const take = Math.min(Math.max(limit, 1), 50);
    const cursorValue = cursor ? await this.decodeCursor(cursor) : null;
    const jobs = await this.prisma.job.findMany({
      where: {
        status: JobStatus.ACTIVE,
        ...(cursorValue ? this.cursorWhere(cursorValue) : {})
      },
      orderBy: [{ publishedAt: "desc" }, { discoveredAt: "desc" }, { id: "desc" }],
      take: take + 1,
      include: this.include()
    });

    const page = jobs.slice(0, take);
    const next = jobs.length > take ? this.encodeCursor(page[page.length - 1]) : null;
    return {
      data: page.map((job) => this.serialize(job)),
      pageInfo: { nextCursor: next },
      freshness: { servedFromStoredData: true }
    };
  }

  async getBySlug(slug: string) {
    const job = await this.prisma.job.findUnique({
      where: { slug },
      include: this.include()
    });
    return job ? this.serialize(job) : null;
  }

  private include() {
    return {
      company: true,
      source: true,
      salaries: true,
      locations: { include: { location: true } },
      providerRecords: {
        select: { providerId: true, externalId: true, sourceUrl: true, applicationUrl: true, lastSeenAt: true }
      }
    } satisfies Prisma.JobInclude;
  }

  private serialize(job: Prisma.JobGetPayload<{ include: ReturnType<JobsService["include"]> }>) {
    return {
      id: job.id,
      slug: job.slug,
      title: job.canonicalTitle,
      company: job.company
        ? {
            slug: job.company.slug,
            name: job.company.canonicalName,
            logoUrl: job.company.logoUrl
          }
        : null,
      employmentType: job.employmentType,
      seniority: job.seniority,
      workMode: job.workMode,
      remoteScope: job.remoteScope,
      remoteRestrictions: {
        countryCodes: job.remoteCountryCodes,
        labels: job.remoteRestrictionLabels,
        timezones: job.remoteTimezoneRestrictions
      },
      remoteRestrictionsText: this.formatRemoteRestrictions(job.remoteRestrictions),
      locations: job.locations.map(({ location }) => ({
        alpha2: location.alpha2,
        name: location.name,
        slug: location.slug
      })),
      salary: job.salaries[0]
        ? {
            min: job.salaries[0].min,
            max: job.salaries[0].max,
            currency: job.salaries[0].currency,
            period: job.salaries[0].period
          }
        : null,
      descriptionHtml: job.descriptionHtml,
      excerpt: job.descriptionText,
      publishedAt: job.publishedAt,
      expiresAt: job.expiresAt,
      providerExpiresAt: job.providerExpiresAt,
      applicationDeadlineAt: job.applicationDeadlineAt,
      deadlineMetadata: job.deadlineMetadata,
      applicationUrl: job.providerRecords[0]?.applicationUrl ?? null,
      applyDomain: this.hostname(job.providerRecords[0]?.applicationUrl ?? null),
      source: job.source
        ? {
            name: job.source.name,
            url: job.providerRecords[0]?.sourceUrl ?? job.source.baseUrl,
            attributionPolicy: job.source.attributionPolicy
          }
        : null
    };
  }

  private hostname(value: string | null) {
    if (!value) return null;
    try {
      return new URL(value).hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  }

  private async decodeCursor(cursor: string) {
    try {
      const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
        publishedAt?: string | null;
        discoveredAt?: string;
        id?: string;
      };
      if (!parsed.id || !parsed.discoveredAt) return null;
      return {
        id: parsed.id,
        publishedAt: parsed.publishedAt ? new Date(parsed.publishedAt) : null,
        discoveredAt: new Date(parsed.discoveredAt)
      };
    } catch {
      const job = await this.prisma.job.findUnique({
        where: { id: cursor },
        select: { id: true, publishedAt: true, discoveredAt: true }
      });
      return job;
    }
  }

  private encodeCursor(job: { id: string; publishedAt: Date | null; discoveredAt: Date }) {
    return Buffer.from(
      JSON.stringify({
        id: job.id,
        publishedAt: job.publishedAt?.toISOString() ?? null,
        discoveredAt: job.discoveredAt.toISOString()
      })
    ).toString("base64url");
  }

  private cursorWhere(cursor: { id: string; publishedAt: Date | null; discoveredAt: Date }): Prisma.JobWhereInput {
    if (!cursor.publishedAt) {
      return {
        OR: [
          { publishedAt: null, discoveredAt: { lt: cursor.discoveredAt } },
          { publishedAt: null, discoveredAt: cursor.discoveredAt, id: { lt: cursor.id } }
        ]
      };
    }

    return {
      OR: [
        { publishedAt: { lt: cursor.publishedAt } },
        { publishedAt: cursor.publishedAt, discoveredAt: { lt: cursor.discoveredAt } },
        { publishedAt: cursor.publishedAt, discoveredAt: cursor.discoveredAt, id: { lt: cursor.id } },
        { publishedAt: null }
      ]
    };
  }

  private formatRemoteRestrictions(value: Prisma.JsonValue | null) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const restrictions = value as { countries?: unknown; labels?: unknown; timezones?: unknown };
    const parts: string[] = [];
    if (Array.isArray(restrictions.labels) && restrictions.labels.length > 0) {
      const labels = restrictions.labels.map((label) => String(label).trim()).filter(Boolean);
      if (labels.length > 0) parts.push(`Location restricted to ${labels.join(", ")}`);
    }
    if (Array.isArray(restrictions.countries) && restrictions.countries.length > 0) {
      const countries = restrictions.countries
        .map((country) => {
          if (!country || typeof country !== "object" || Array.isArray(country)) return null;
          const name = (country as { name?: unknown }).name;
          return typeof name === "string" && name.trim() ? name.trim() : null;
        })
        .filter(Boolean);
      if (countries.length > 0) parts.push(`Location restricted to ${countries.join(", ")}`);
    }
    if (Array.isArray(restrictions.timezones) && restrictions.timezones.length > 0) {
      const timezones = restrictions.timezones.map((timezone) => formatTimezone(String(timezone))).filter(Boolean);
      if (timezones.length > 0) parts.push(`Timezone overlap required: ${timezones.join(", ")}`);
    }
    return parts.length > 0 ? parts.join("; ") : "Remote - Worldwide";
  }
}

function formatTimezone(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^utc/i.test(trimmed)) return trimmed.toUpperCase().replace("UTC+", "UTC+").replace("UTC-", "UTC-");
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric)) return trimmed;
  return `UTC${numeric >= 0 ? "+" : ""}${trimmed}`;
}
