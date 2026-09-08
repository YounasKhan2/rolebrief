import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { JobStatus, Prisma } from "@prisma/client";
import { AppConfigService } from "../../common/config/app-config.service";
import { PrismaService } from "../../prisma/prisma.service";
import { JobFacetsQueryDto, JobSortOption, JobsQueryDto } from "./dto/jobs-query.dto";
import {
  computeQueryHash,
  decodeCursor,
  encodeCursor,
  KeysetCursorPayload
} from "./jobs-cursor.util";
import { JobsSearchRepository } from "./jobs-search.repository";

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly searchRepo: JobsSearchRepository,
    private readonly config: AppConfigService
  ) {}

  async list(query: JobsQueryDto = {}) {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 50);
    const sort = query.sort || (query.q ? JobSortOption.RELEVANCE : JobSortOption.NEWEST);
    const qHash = computeQueryHash({ ...query, sort });

    let cursorPayload: KeysetCursorPayload | null = null;
    if (query.cursor) {
      cursorPayload = decodeCursor(query.cursor, this.config.cursorSigningSecret, qHash);
      if (cursorPayload.sort !== sort) {
        throw new BadRequestException("Cursor sort mode does not match query sort parameter");
      }
    }

    const { items, totalCount } = await this.searchRepo.searchJobIds(query, cursorPayload, limit);

    const hasNextPage = items.length > limit;
    const pageItems = items.slice(0, limit);

    let nextCursor: string | null = null;
    if (hasNextPage && pageItems.length > 0) {
      const last = pageItems[pageItems.length - 1];
      nextCursor = encodeCursor(
        {
          v: 1,
          sort,
          val: [
            formatSortValue(last.sortVal1) ?? (last.rank ?? null),
            formatSortValue(last.sortVal2) ?? null,
            formatSortValue(last.sortVal3) ?? null
          ],
          id: last.id,
          qHash
        },
        this.config.cursorSigningSecret
      );
    }

    let serializedJobs: any[] = [];
    if (pageItems.length > 0) {
      const jobs = await this.prisma.job.findMany({
        where: { id: { in: pageItems.map((i) => i.id) } },
        include: this.include()
      });

      const jobMap = new Map(jobs.map((j) => [j.id, j]));
      serializedJobs = pageItems
        .map((item) => jobMap.get(item.id))
        .filter((job): job is NonNullable<typeof job> => Boolean(job))
        .map((job) => this.serialize(job, { isDetail: false }));
    }

    return {
      data: serializedJobs,
      pageInfo: {
        nextCursor,
        hasNextPage
      },
      totalCount,
      appliedFilters: {
        q: query.q ?? null,
        country: query.country ?? null,
        remoteScope: query.remoteScope ?? null,
        workMode: query.workMode ?? null,
        timezone: query.timezone ?? null,
        seniority: query.seniority ?? null,
        employmentType: query.employmentType ?? null,
        category: query.category ?? null,
        company: query.company ?? null,
        salaryMin: query.salaryMin ?? null,
        salaryMax: query.salaryMax ?? null,
        currency: query.currency ?? null,
        publishedAfter: query.publishedAfter ?? null,
        deadlineBefore: query.deadlineBefore ?? null,
        provider: query.provider ?? null,
        status: query.status ?? JobStatus.ACTIVE,
        sort
      }
    };
  }

  async getBySlug(slug: string) {
    const job = await this.prisma.job.findUnique({
      where: { slug },
      include: this.include()
    });
    return job ? this.serialize(job, { isDetail: true }) : null;
  }

  async getRelated(slug: string, limit = 6) {
    const job = await this.prisma.job.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        canonicalTitle: true,
        seniority: true,
        workMode: true,
        remoteScope: true,
        requiredSkills: true,
        companyId: true,
        status: true
      }
    });

    if (!job) {
      throw new NotFoundException("Job not found");
    }

    const relatedIds = await this.searchRepo.findRelatedJobs(job, limit);
    if (relatedIds.length === 0) {
      return [];
    }

    const relatedJobs = await this.prisma.job.findMany({
      where: { id: { in: relatedIds } },
      include: this.include()
    });

    const jobMap = new Map(relatedJobs.map((j) => [j.id, j]));
    return relatedIds
      .map((id) => jobMap.get(id))
      .filter((j): j is NonNullable<typeof j> => Boolean(j))
      .map((j) => this.serialize(j, { isDetail: false }));
  }

  async getFacets(query: JobFacetsQueryDto = {}) {
    return this.searchRepo.getFacets(query);
  }

  public include() {
    return {
      company: true,
      source: true,
      salaries: true,
      locations: { include: { location: true } },
      providerRecords: {
        select: {
          providerId: true,
          externalId: true,
          sourceUrl: true,
          applicationUrl: true,
          lastSeenAt: true
        }
      }
    } satisfies Prisma.JobInclude;
  }

  public serialize(
    job: Prisma.JobGetPayload<{ include: ReturnType<JobsService["include"]> }>,
    options: { isDetail?: boolean } = {}
  ) {
    const isDetail = options.isDetail ?? false;
    const primaryRecord = job.providerRecords[0];
    const sourceUrl = primaryRecord?.sourceUrl || job.source?.baseUrl || null;
    const applicationUrl = primaryRecord?.applicationUrl || sourceUrl;
    const applyDomain = this.hostname(applicationUrl);

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
        countryCodes: job.remoteCountryCodes || [],
        labels: job.remoteRestrictionLabels || [],
        timezones: job.remoteTimezoneRestrictions || []
      },
      remoteRestrictionsText: this.formatRemoteRestrictions(
        job.workMode,
        job.remoteScope,
        job.remoteRestrictions,
        job.remoteRestrictionLabels,
        job.remoteCountryCodes,
        job.remoteTimezoneRestrictions
      ),
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
      descriptionHtml: isDetail ? job.descriptionHtml : null,
      excerpt: isDetail
        ? job.descriptionText
        : job.descriptionText
          ? (job.descriptionText.length > 280 ? `${job.descriptionText.slice(0, 280).trim()}…` : job.descriptionText)
          : null,
      publishedAt: job.publishedAt,
      expiresAt: job.expiresAt,
      providerExpiresAt: job.providerExpiresAt,
      applicationDeadlineAt: job.applicationDeadlineAt,
      deadlineMetadata: isDetail ? job.deadlineMetadata : null,
      applicationUrl,
      applyDomain,
      source: job.source
        ? {
            name: job.source.name,
            url: sourceUrl,
            attributionPolicy: isDetail ? job.source.attributionPolicy : undefined
          }
        : null
    };
  }

  private hostname(value: string | null): string | null {
    if (!value) return null;
    try {
      return new URL(value).hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  }

  private formatRemoteRestrictions(
    workMode: string,
    remoteScope: string | null,
    remoteRestrictionsJson: Prisma.JsonValue | null,
    labels: string[] = [],
    countryCodes: string[] = [],
    timezones: string[] = []
  ): string {
    if (workMode === "ONSITE") {
      return labels.length > 0 ? `On-site · ${labels.join(", ")}` : "On-site";
    }
    if (workMode === "HYBRID") {
      return labels.length > 0 ? `Hybrid · ${labels.join(", ")}` : "Hybrid";
    }

    // WorkMode is REMOTE
    const allLabels = Array.from(new Set([...labels])).filter(Boolean);
    const hasCountries = allLabels.length > 0 || countryCodes.length > 0;
    const hasTimezones = timezones.length > 0;

    const parts: string[] = [];

    if (remoteScope === "WORLDWIDE" && !hasCountries && !hasTimezones) {
      return "Remote · Worldwide";
    }

    if (hasCountries) {
      if (allLabels.length === 1) {
        parts.push(`${allLabels[0]} only`);
      } else if (allLabels.length > 1) {
        parts.push(allLabels.join(", "));
      } else if (countryCodes.length > 0) {
        parts.push(countryCodes.join(", "));
      }
    }

    if (hasTimezones) {
      const formattedTimezones = timezones.map((tz) => formatTimezoneOffset(tz)).filter(Boolean);
      if (formattedTimezones.length === 1) {
        parts.push(`${formattedTimezones[0]} overlap`);
      } else if (formattedTimezones.length > 1) {
        parts.push(`${formattedTimezones[0]} to ${formattedTimezones[formattedTimezones.length - 1]} overlap`);
      }
    }

    if (parts.length === 0) {
      return "Remote · Location requirements unclear";
    }

    return `Remote · ${parts.join(" · ")}`;
  }
}

function formatTimezoneOffset(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^utc/i.test(trimmed)) {
    return trimmed.toUpperCase().replace("UTC+", "UTC+").replace("UTC-", "UTC-");
  }
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric)) return trimmed;
  return `UTC${numeric >= 0 ? "+" : ""}${trimmed}`;
}

function formatSortValue(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number" || typeof value === "string") return value;
  return String(value);
}
