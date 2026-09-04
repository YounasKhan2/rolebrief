import { Injectable } from "@nestjs/common";
import { JobStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(cursor?: string, limit = 20) {
    const take = Math.min(Math.max(limit, 1), 50);
    const jobs = await this.prisma.job.findMany({
      where: { status: JobStatus.ACTIVE },
      orderBy: [{ publishedAt: "desc" }, { discoveredAt: "desc" }],
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: this.include()
    });

    const page = jobs.slice(0, take);
    const next = jobs.length > take ? jobs[take]?.id ?? null : null;
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
      remoteRestrictions: job.remoteRestrictions,
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
      source: job.source
        ? {
            name: job.source.name,
            url: job.providerRecords[0]?.sourceUrl ?? job.source.baseUrl,
            attributionPolicy: job.source.attributionPolicy
          }
        : null
    };
  }
}
