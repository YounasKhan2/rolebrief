import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AppConfigService } from "../../common/config/app-config.service";
import { PrismaService } from "../../prisma/prisma.service";
import { HimalayasAdapter } from "./himalayas.adapter";
import { normalizeHimalayasJob, NormalizedHimalayasJob } from "./himalayas.normalizer";

type IngestionMode = "initial-backfill" | "recurring-sync" | "live-smoke";
type PersistOutcome = "created" | "updated" | "unchanged";

@Injectable()
export class HimalayasIngestionService {
  private readonly logger = new Logger(HimalayasIngestionService.name);
  private readonly source = {
    slug: "himalayas",
    name: "Himalayas",
    baseUrl: "https://himalayas.app",
    attributionPolicy: "Display visible Himalayas attribution and link to the original job."
  };

  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
    private readonly adapter: HimalayasAdapter
  ) {}

  async ingest(options: { mode?: IngestionMode; pageLimit?: number } = {}) {
    const settings = this.config.himalayas;
    if (!settings.enabled) {
      return { skipped: true, reason: "Himalayas provider disabled", fetched: 0, accepted: 0, rejected: 0 };
    }

    const mode = options.mode ?? "recurring-sync";
    const pageLimit =
      options.pageLimit ??
      (mode === "initial-backfill" ? settings.initialBackfillPages : mode === "live-smoke" ? 1 : settings.recurringSyncPages);
    const run = await this.prisma.ingestionRun.create({
      data: { providerId: this.adapter.providerId, partition: `jobs:${mode}`, status: "running" }
    });

    let cursor: string | null = null;
    let pagesFetched = 0;
    let fetched = 0;
    let accepted = 0;
    let rejected = 0;
    let created = 0;
    let updated = 0;
    let unchanged = 0;
    let consecutiveUnchanged = 0;
    let stopReason = "page_limit";
    const failures: Prisma.InputJsonValue[] = [];

    try {
      for (let page = 0; page < pageLimit; page += 1) {
        const providerPage = await this.adapter.fetchPage(cursor);
        pagesFetched += 1;
        failures.push(...providerPage.partialFailures.map((failure) => ({ ...failure }) as Prisma.InputJsonObject));

        if (providerPage.records.length === 0 && providerPage.partialFailures.length > 0) {
          stopReason = "provider_error";
          break;
        }

        for (const record of providerPage.records) {
          fetched += 1;
          try {
            const outcome = await this.persist(normalizeHimalayasJob(record));
            accepted += 1;
            if (outcome === "created") {
              created += 1;
              consecutiveUnchanged = 0;
            } else if (outcome === "updated") {
              updated += 1;
              consecutiveUnchanged = 0;
            } else {
              unchanged += 1;
              consecutiveUnchanged += 1;
            }
          } catch (error) {
            rejected += 1;
            this.logger.warn(error instanceof Error ? error.message : "Failed to persist Himalayas record");
          }
        }

        cursor = providerPage.nextCursor;
        if (providerPage.terminal || !cursor) {
          stopReason = "terminal_cursor";
          break;
        }
        if (mode === "recurring-sync" && consecutiveUnchanged >= settings.unchangedStopThreshold) {
          stopReason = "unchanged_threshold";
          break;
        }
      }

      await this.prisma.ingestionRun.update({
        where: { id: run.id },
        data: {
          status: failures.length > 0 ? "partial" : "succeeded",
          pagesFetched,
          recordsFetched: fetched,
          recordsAccepted: accepted,
          recordsRejected: rejected,
          recordsCreated: created,
          recordsUpdated: updated,
          recordsUnchanged: unchanged,
          terminalCursor: cursor,
          stopReason,
          finishedAt: new Date(),
          metadata: { mode, pageLimit, failures } as Prisma.InputJsonObject
        }
      });

      return { skipped: false, mode, pagesFetched, fetched, accepted, rejected, created, updated, unchanged, terminalCursor: cursor, stopReason, failures };
    } catch (error) {
      await this.prisma.ingestionRun.update({
        where: { id: run.id },
        data: {
          status: "failed",
          pagesFetched,
          recordsFetched: fetched,
          recordsAccepted: accepted,
          recordsRejected: rejected,
          recordsCreated: created,
          recordsUpdated: updated,
          recordsUnchanged: unchanged,
          terminalCursor: cursor,
          stopReason: "exception",
          finishedAt: new Date(),
          metadata: { mode, pageLimit, failures, error: error instanceof Error ? error.message : "unknown" } as Prisma.InputJsonObject
        }
      });
      throw error;
    }
  }

  private async persist(job: NormalizedHimalayasJob): Promise<PersistOutcome> {
    const source = await this.prisma.source.upsert({
      where: { slug: this.source.slug },
      create: this.source,
      update: this.source
    });

    const company = await this.prisma.company.upsert({
      where: { slug: job.companySlug },
      create: {
        slug: job.companySlug,
        canonicalName: job.companyName,
        logoUrl: job.companyLogo,
        aliases: [job.companyName]
      },
      update: {
        canonicalName: job.companyName,
        logoUrl: job.companyLogo,
        aliases: { set: [job.companyName] }
      }
    });

    const existingProviderRecord = await this.prisma.providerRecord.findUnique({
      where: { providerId_externalId_recordType: { providerId: this.adapter.providerId, externalId: job.externalId, recordType: "job" } },
      select: { contentHash: true, jobId: true }
    });
    const outcome: PersistOutcome = existingProviderRecord ? (existingProviderRecord.contentHash === job.contentHash ? "unchanged" : "updated") : "created";

    const savedJob = await this.prisma.job.upsert({
      where: { slug: job.slug },
      create: {
        slug: job.slug,
        canonicalTitle: job.title,
        descriptionHtml: job.descriptionHtml,
        descriptionText: job.descriptionText,
        employmentType: job.employmentType,
        seniority: job.seniority,
        workMode: job.workMode,
        remoteScope: job.remoteScope,
        remoteRestrictions: job.remoteRestrictions as Prisma.InputJsonValue,
        requiredSkills: [...job.categories, ...job.parentCategories],
        contentHash: job.contentHash,
        status: job.expiresAt && job.expiresAt < new Date() ? "EXPIRED" : "ACTIVE",
        moderationState: "approved",
        sourceDisclosure: { provider: this.adapter.providerId, sourceUrl: job.sourceUrl, applicationUrl: job.applicationUrl },
        searchDocument: [job.title, job.companyName, job.descriptionText, job.categories.join(" "), job.parentCategories.join(" ")].filter(Boolean).join(" "),
        publishedAt: job.publishedAt,
        expiresAt: job.expiresAt,
        companyId: company.id,
        sourceId: source.id
      },
      update: {
        canonicalTitle: job.title,
        descriptionHtml: job.descriptionHtml,
        descriptionText: job.descriptionText,
        employmentType: job.employmentType,
        seniority: job.seniority,
        workMode: job.workMode,
        remoteScope: job.remoteScope,
        remoteRestrictions: job.remoteRestrictions as Prisma.InputJsonValue,
        requiredSkills: { set: [...job.categories, ...job.parentCategories] },
        contentHash: job.contentHash,
        status: job.expiresAt && job.expiresAt < new Date() ? "EXPIRED" : "ACTIVE",
        sourceDisclosure: { provider: this.adapter.providerId, sourceUrl: job.sourceUrl, applicationUrl: job.applicationUrl },
        searchDocument: [job.title, job.companyName, job.descriptionText, job.categories.join(" "), job.parentCategories.join(" ")].filter(Boolean).join(" "),
        publishedAt: job.publishedAt,
        expiresAt: job.expiresAt,
        companyId: company.id,
        sourceId: source.id
      }
    });

    await this.prisma.providerRecord.upsert({
      where: { providerId_externalId_recordType: { providerId: this.adapter.providerId, externalId: job.externalId, recordType: "job" } },
      create: {
        providerId: this.adapter.providerId,
        externalId: job.externalId,
        recordType: "job",
        sourceId: source.id,
        jobId: savedJob.id,
        companyId: company.id,
        sourceUrl: job.sourceUrl,
        applicationUrl: job.applicationUrl,
        rawPayload: job.raw as Prisma.InputJsonValue,
        schemaVersion: "himalayas.jobs.v1",
        contentHash: job.contentHash,
        providerPublishedAt: job.publishedAt,
        providerUpdatedAt: job.publishedAt
      },
      update: {
        sourceId: source.id,
        jobId: savedJob.id,
        companyId: company.id,
        sourceUrl: job.sourceUrl,
        applicationUrl: job.applicationUrl,
        rawPayload: job.raw as Prisma.InputJsonValue,
        schemaVersion: "himalayas.jobs.v1",
        contentHash: job.contentHash,
        providerPublishedAt: job.publishedAt,
        providerUpdatedAt: job.publishedAt,
        lastSeenAt: new Date(),
        observedState: "active"
      }
    });

    if (job.salary) {
      await this.prisma.salary.deleteMany({ where: { jobId: savedJob.id, source: "himalayas" } });
      await this.prisma.salary.create({
        data: {
          jobId: savedJob.id,
          min: job.salary.min,
          max: job.salary.max,
          currency: job.salary.currency,
          period: job.salary.period,
          source: "himalayas",
          ambiguity: "provider_reported"
        }
      });
    } else {
      await this.prisma.salary.deleteMany({ where: { jobId: savedJob.id, source: "himalayas" } });
    }

    await this.prisma.jobLocation.deleteMany({ where: { jobId: savedJob.id } });
    for (const location of job.locations) {
      const savedLocation = await this.prisma.location.upsert({
        where: { slug: location.slug },
        create: location,
        update: { alpha2: location.alpha2, name: location.name }
      });
      await this.prisma.jobLocation.create({
        data: { jobId: savedJob.id, locationId: savedLocation.id }
      });
    }

    return outcome;
  }
}
