import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { JobsService } from "../jobs/jobs.service";

@Injectable()
export class SavedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobsService: JobsService
  ) {}

  async getSavedJobSlugs(userId: string): Promise<string[]> {
    const items = await this.prisma.savedItem.findMany({
      where: {
        userId,
        itemType: "JOB"
      },
      select: {
        itemId: true
      },
      orderBy: {
        createdAt: "desc"
      }
    });
    return items.map((i) => i.itemId);
  }

  async getSavedJobs(userId: string) {
    const items = await this.prisma.savedItem.findMany({
      where: {
        userId,
        itemType: "JOB"
      },
      orderBy: {
        createdAt: "desc"
      },
      include: {
        job: {
          include: this.jobsService.include()
        }
      }
    });

    const jobs = items
      .filter((item): item is typeof item & { job: NonNullable<typeof item.job> } => Boolean(item.job))
      .map((item) => {
        const serialized = this.jobsService.serialize(item.job, { isDetail: false });
        return {
          ...serialized,
          savedAt: item.createdAt.toISOString()
        };
      });

    return {
      data: jobs,
      totalCount: jobs.length
    };
  }

  async saveJob(userId: string, slug: string) {
    const job = await this.prisma.job.findUnique({
      where: { slug },
      select: { id: true, slug: true }
    });

    if (!job) {
      throw new NotFoundException(`Job with slug "${slug}" not found`);
    }

    await this.prisma.savedItem.upsert({
      where: {
        userId_itemType_itemId: {
          userId,
          itemType: "JOB",
          itemId: slug
        }
      },
      create: {
        userId,
        itemType: "JOB",
        itemId: slug,
        jobId: job.id
      },
      update: {
        jobId: job.id
      }
    });

    return { success: true, saved: true, slug };
  }

  async unsaveJob(userId: string, slug: string) {
    await this.prisma.savedItem.deleteMany({
      where: {
        userId,
        itemType: "JOB",
        itemId: slug
      }
    });

    return { success: true, saved: false, slug };
  }
}
