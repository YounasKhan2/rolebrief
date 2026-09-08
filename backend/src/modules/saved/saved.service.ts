import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { JobsService } from "../jobs/jobs.service";
import { SavedJobsQueryDto } from "./dto/saved-query.dto";

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

  async getSavedJobs(userId: string, query: SavedJobsQueryDto = new SavedJobsQueryDto()) {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 50);
    const cursor = query.cursor;

    const totalCount = await this.prisma.savedItem.count({
      where: {
        userId,
        itemType: "JOB"
      }
    });

    let items: Array<
      Prisma.SavedItemGetPayload<{
        include: {
          job: {
            include: ReturnType<JobsService["include"]>;
          };
        };
      }>
    > = [];

    try {
      items = await this.prisma.savedItem.findMany({
        where: {
          userId,
          itemType: "JOB"
        },
        take: limit + 1,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: [
          { createdAt: "desc" },
          { id: "desc" }
        ],
        include: {
          job: {
            include: this.jobsService.include()
          }
        }
      });
    } catch (err: any) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        throw new BadRequestException("Invalid cursor provided");
      }
      throw err;
    }

    const hasNextPage = items.length > limit;
    const pageItems = hasNextPage ? items.slice(0, limit) : items;
    const nextCursor = hasNextPage && pageItems.length > 0 ? pageItems[pageItems.length - 1].id : null;

    const jobs = pageItems
      .filter((item): item is typeof item & { job: NonNullable<typeof item.job> } => Boolean(item.job))
      .map((item) => {
        const serialized = this.jobsService.serialize(item.job, { isDetail: false });
        const isExpired =
          item.job.status === "EXPIRED" ||
          (item.job.expiresAt ? new Date(item.job.expiresAt).getTime() < Date.now() : false);

        return {
          ...serialized,
          status: item.job.status,
          isExpired,
          savedAt: item.createdAt.toISOString()
        };
      });

    return {
      data: jobs,
      pageInfo: {
        nextCursor,
        hasNextPage
      },
      totalCount
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
