import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AppConfigService } from "../../common/config/app-config.service";
import { PrismaService } from "../../prisma/prisma.service";
import { HimalayasAdapter } from "./himalayas.adapter";
import { normalizeHimalayasJob, NormalizedHimalayasJob } from "./himalayas.normalizer";

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

  async ingest() {
    const settings = this.config.himalayas;
    if (!settings.enabled) {
      return { skipped: true, reason: "Himalayas provider disabled", fetched: 0, accepted: 0, rejected: 0 };
    }

    const run = await this.prisma.ingestionRun.create({
      data: { providerId: this.adapter.providerId, partition: "jobs", status: "running" }
    });

    let cursor: string | null = null;
    let fetched = 0;
    let accepted = 0;
    let rejected = 0;
    const failures: Prisma.InputJsonValue[] = [];

    try {
      for (let page = 0; page < settings.maxPagesPerRun; page += 1) {
        const providerPage = await this.adapter.fetchPage(cursor);
        failures.push(...providerPage.partialFailures.map((failure) => ({ ...failure }) as Prisma.InputJsonObject));

        if (providerPage.records.length === 0 && providerPage.partialFailures.length > 0) {
          rejected += 1;
          break;
        }

        for (const record of providerPage.records) {
          fetched += 1;
          try {
            await this.persist(normalizeHimalayasJob(record));
            accepted += 1;
          } catch (error) {
            rejected += 1;
            this.logger.warn(error instanceof Error ? error.message : "Failed to persist Himalayas record");
          }
        }

        cursor = providerPage.nextCursor;
        if (!cursor) break;
      }

      await this.prisma.ingestionRun.update({
        where: { id: run.id },
        data: {
          status: failures.length > 0 ? "partial" : "succeeded",
          recordsFetched: fetched,
          recordsAccepted: accepted,
          recordsRejected: rejected,
          finishedAt: new Date(),
          metadata: { failures } as Prisma.InputJsonObject
        }
      });

      return { skipped: false, fetched, accepted, rejected, failures };
    } catch (error) {
      await this.prisma.ingestionRun.update({
        where: { id: run.id },
        data: {
          status: "failed",
          recordsFetched: fetched,
          recordsAccepted: accepted,
          recordsRejected: rejected,
          finishedAt: new Date(),
          metadata: { failures, error: error instanceof Error ? error.message : "unknown" } as Prisma.InputJsonObject
        }
      });
      throw error;
    }
  }

  private async persist(job: NormalizedHimalayasJob) {
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
        requiredSkills: job.categories,
        contentHash: job.contentHash,
        status: job.expiresAt && job.expiresAt < new Date() ? "EXPIRED" : "ACTIVE",
        moderationState: "approved",
        sourceDisclosure: { provider: "himalayas", sourceUrl: job.sourceUrl },
        searchDocument: [job.title, job.companyName, job.descriptionText, job.categories.join(" ")].filter(Boolean).join(" "),
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
        requiredSkills: { set: job.categories },
        contentHash: job.contentHash,
        status: job.expiresAt && job.expiresAt < new Date() ? "EXPIRED" : "ACTIVE",
        sourceDisclosure: { provider: "himalayas", sourceUrl: job.sourceUrl },
        searchDocument: [job.title, job.companyName, job.descriptionText, job.categories.join(" ")].filter(Boolean).join(" "),
        publishedAt: job.publishedAt,
        expiresAt: job.expiresAt,
        companyId: company.id,
        sourceId: source.id
      }
    });

    await this.prisma.providerRecord.upsert({
      where: { providerId_externalId_recordType: { providerId: "himalayas", externalId: job.externalId, recordType: "job" } },
      create: {
        providerId: "himalayas",
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

    return savedJob;
  }
}
