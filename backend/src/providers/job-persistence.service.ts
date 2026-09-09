import { Injectable } from "@nestjs/common";
import { JobStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CanonicalJobInput, ProviderKey } from "./provider-adapter";

export type PersistOutcome = "created" | "updated" | "unchanged" | "expired";

@Injectable()
export class JobPersistenceService {
  constructor(private readonly prisma: PrismaService) {}

  async persist(providerKey: ProviderKey, job: CanonicalJobInput): Promise<PersistOutcome> {
    const sourceConfig = sourceFor(providerKey);

    return this.prisma.$transaction(async (tx) => {
      const source = await tx.source.upsert({
        where: { slug: sourceConfig.slug },
        create: sourceConfig,
        update: sourceConfig
      });

      const company = await tx.company.upsert({
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

      const existingProviderRecord = await tx.providerRecord.findUnique({
        where: { providerId_externalId_recordType: { providerId: providerKey, externalId: job.externalId, recordType: "job" } },
        select: { contentHash: true }
      });
      const expired = job.providerExpiresAt !== null && job.providerExpiresAt < new Date();
      const outcome: PersistOutcome = existingProviderRecord
        ? existingProviderRecord.contentHash === job.contentHash
          ? expired
            ? "expired"
            : "unchanged"
          : expired
            ? "expired"
            : "updated"
        : expired
          ? "expired"
          : "created";

      const updateData = {
        canonicalTitle: job.title,
        descriptionHtml: job.descriptionHtml,
        descriptionText: job.descriptionText,
        employmentType: job.employmentType,
        seniority: job.seniority,
        workMode: job.workMode,
        remoteScope: job.remote.scope,
        remoteRestrictions: job.remote as unknown as Prisma.InputJsonValue,
        remoteCountryCodes: { set: job.remote.countryCodes },
        remoteRestrictionLabels: { set: job.remote.labels },
        remoteTimezoneRestrictions: { set: job.remote.timezones },
        requiredSkills: { set: [...job.categories, ...job.parentCategories] },
        contentHash: job.contentHash,
        canonicalFingerprint: job.canonicalFingerprint,
        status: expired ? JobStatus.EXPIRED : JobStatus.ACTIVE,
        moderationState: "approved",
        sourceDisclosure: { provider: providerKey, sourceUrl: job.sourceUrl, applicationUrl: job.applicationUrl },
        searchDocument: [job.title, job.companyName, job.descriptionText, job.categories.join(" "), job.parentCategories.join(" ")].filter(Boolean).join(" "),
        publishedAt: job.sourcePublishedAt,
        sourcePublishedAt: job.sourcePublishedAt,
        sourceUpdatedAt: job.sourceUpdatedAt,
        providerExpiresAt: job.providerExpiresAt,
        applicationDeadlineAt: job.applicationDeadlineAt,
        deadlineMetadata: deadlineMetadata(job) as Prisma.InputJsonValue,
        expiresAt: job.providerExpiresAt,
        expiredAt: expired ? job.providerExpiresAt : null,
        lastSeenAt: new Date(),
        companyId: company.id,
        sourceId: source.id
      };

      const savedJob = await tx.job.upsert({
        where: { slug: job.slug },
        create: {
          slug: job.slug,
          ...updateData,
          remoteCountryCodes: job.remote.countryCodes,
          remoteRestrictionLabels: job.remote.labels,
          remoteTimezoneRestrictions: job.remote.timezones,
          requiredSkills: [...job.categories, ...job.parentCategories]
        } as Prisma.JobCreateInput,
        update: updateData as Prisma.JobUncheckedUpdateInput
      });

      await tx.providerRecord.upsert({
        where: { providerId_externalId_recordType: { providerId: providerKey, externalId: job.externalId, recordType: "job" } },
        create: {
          providerId: providerKey,
          externalId: job.externalId,
          recordType: "job",
          sourceId: source.id,
          jobId: savedJob.id,
          companyId: company.id,
          sourceUrl: job.sourceUrl,
          applicationUrl: job.applicationUrl,
          rawPayload: job.raw as Prisma.InputJsonValue,
          schemaVersion: `${sourceConfig.slug}.jobs.v1`,
          contentHash: job.contentHash,
          providerPublishedAt: job.sourcePublishedAt,
          providerUpdatedAt: job.sourceUpdatedAt
        },
        update: {
          sourceId: source.id,
          jobId: savedJob.id,
          companyId: company.id,
          sourceUrl: job.sourceUrl,
          applicationUrl: job.applicationUrl,
          rawPayload: job.raw as Prisma.InputJsonValue,
          schemaVersion: `${sourceConfig.slug}.jobs.v1`,
          contentHash: job.contentHash,
          providerPublishedAt: job.sourcePublishedAt,
          providerUpdatedAt: job.sourceUpdatedAt,
          lastSeenAt: new Date(),
          observedState: expired ? "expired" : "active"
        }
      });

      await tx.salary.deleteMany({ where: { jobId: savedJob.id, source: sourceConfig.slug } });
      if (job.salary) {
        await tx.salary.create({
          data: {
            jobId: savedJob.id,
            min: job.salary.min,
            max: job.salary.max,
            currency: job.salary.currency,
            period: job.salary.period,
            source: sourceConfig.slug,
            ambiguity: "provider_reported"
          }
        });
      }

      await tx.jobLocation.deleteMany({ where: { jobId: savedJob.id } });
      for (const location of job.remote.countries) {
        const savedLocation = await tx.location.upsert({
          where: { slug: location.slug },
          create: location,
          update: { alpha2: location.alpha2, name: location.name }
        });
        await tx.jobLocation.create({ data: { jobId: savedJob.id, locationId: savedLocation.id } });
      }

      if (outcome === "created") {
        await tx.jobOutboxEvent.create({
          data: {
            jobId: savedJob.id,
            eventType: "JOB_CREATED",
            status: "PENDING"
          }
        });
      }

      return outcome;
    });
  }
}

function sourceFor(providerKey: ProviderKey) {
  if (providerKey === "himalayas.guid") {
    return {
      slug: "himalayas",
      name: "Himalayas",
      baseUrl: "https://himalayas.app",
      attributionPolicy: "Display visible Himalayas attribution and link to the original job."
    };
  }
  return {
    slug: String(providerKey).replace(/[^a-z0-9]+/gi, "-").toLowerCase(),
    name: String(providerKey),
    baseUrl: "https://example.invalid",
    attributionPolicy: "Provider attribution required."
  };
}

function deadlineMetadata(job: CanonicalJobInput) {
  if (job.applicationDeadlineAt) return { type: "application_deadline", source: "provider", confidence: "provider_reported" };
  if (job.providerExpiresAt) return { type: "provider_expiry", source: "provider", confidence: "provider_reported" };
  return undefined;
}
