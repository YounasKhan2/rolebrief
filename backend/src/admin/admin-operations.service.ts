import { InjectQueue } from "@nestjs/bullmq";
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { JobStatus, Prisma } from "@prisma/client";
import { Queue } from "bullmq";
import { AppConfigService } from "../common/config/app-config.service";
import { RateLimitService } from "../common/rate-limit/rate-limit.service";
import { PrismaService } from "../prisma/prisma.service";
import { INGEST_HIMALAYAS_JOB, QUEUES } from "../queue/queue.constants";
import { AdminModerationActionDto, AdminModerationActionType, AdminModerationQueueQueryDto } from "./dto/admin-operations.dto";

export interface AdminMetricsResult {
  users: {
    total: number;
    active: number;
    locked: number;
    disabled: number;
  };
  jobs: {
    total: number;
    active: number;
    stale: number;
    expired: number;
    suspicious: number;
    flagged: number;
    pendingModeration: number;
  };
  ingestion: {
    runsLast24h: number;
    failedRunsLast24h: number;
    recordsCreatedLast24h: number;
    recordsUpdatedLast24h: number;
  };
  pipelines: {
    outboxPending: number;
    outboxFailed: number;
    emailQueued: number;
    emailFailed: number;
    alertsActive: number;
  };
}

export interface AdminSourceItem {
  id: string;
  name: string;
  kind: string;
  region: string;
  status: "healthy" | "degraded" | "down";
  enabled: boolean;
  cronSchedule: string | null;
  lastRun: {
    id: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    recordsFetched: number;
    recordsCreated: number;
    recordsUpdated: number;
    recordsExpired: number;
    stopReason: string | null;
  } | null;
  checkpoint: {
    mode: string;
    updatedAt: string;
    cursor: string | null;
  } | null;
  stats24h: {
    runs: number;
    failures: number;
    recordsCreated: number;
  };
}

@Injectable()
export class AdminOperationsService {
  private readonly logger = new Logger(AdminOperationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly rateLimit: RateLimitService,
    @InjectQueue(QUEUES.ingestion) private readonly ingestionQueue: Queue
  ) {}

  async getMetrics(): Promise<AdminMetricsResult> {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      lockedUsers,
      disabledUsers,
      totalJobs,
      activeJobs,
      staleJobs,
      expiredJobs,
      suspiciousJobs,
      flaggedJobs,
      pendingModerationJobs,
      runsLast24h,
      failedRunsLast24h,
      aggregates24h,
      outboxPending,
      outboxFailed,
      emailQueued,
      emailFailed,
      alertsActive
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: "ACTIVE" } }),
      this.prisma.user.count({ where: { status: "LOCKED" } }),
      this.prisma.user.count({ where: { status: "DISABLED" } }),
      this.prisma.job.count(),
      this.prisma.job.count({ where: { status: JobStatus.ACTIVE } }),
      this.prisma.job.count({ where: { status: JobStatus.STALE } }),
      this.prisma.job.count({ where: { status: JobStatus.EXPIRED } }),
      this.prisma.job.count({ where: { status: JobStatus.SUSPICIOUS } }),
      this.prisma.job.count({ where: { moderationState: "flagged" } }),
      this.prisma.job.count({ where: { moderationState: "pending" } }),
      this.prisma.ingestionRun.count({ where: { startedAt: { gte: since24h } } }),
      this.prisma.ingestionRun.count({ where: { startedAt: { gte: since24h }, status: "failed" } }),
      this.prisma.ingestionRun.aggregate({
        where: { startedAt: { gte: since24h } },
        _sum: { recordsCreated: true, recordsUpdated: true }
      }),
      this.prisma.jobOutboxEvent.count({ where: { status: "PENDING" } }),
      this.prisma.jobOutboxEvent.count({ where: { status: "FAILED" } }),
      this.prisma.emailDelivery.count({ where: { status: "QUEUED" } }),
      this.prisma.emailDelivery.count({ where: { status: "FAILED" } }),
      this.prisma.alert.count({ where: { status: "ACTIVE" } })
    ]);

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        locked: lockedUsers,
        disabled: disabledUsers
      },
      jobs: {
        total: totalJobs,
        active: activeJobs,
        stale: staleJobs,
        expired: expiredJobs,
        suspicious: suspiciousJobs,
        flagged: flaggedJobs,
        pendingModeration: pendingModerationJobs
      },
      ingestion: {
        runsLast24h,
        failedRunsLast24h,
        recordsCreatedLast24h: aggregates24h._sum.recordsCreated ?? 0,
        recordsUpdatedLast24h: aggregates24h._sum.recordsUpdated ?? 0
      },
      pipelines: {
        outboxPending,
        outboxFailed,
        emailQueued,
        emailFailed,
        alertsActive
      }
    };
  }

  async getSources(): Promise<{ sources: AdminSourceItem[] }> {
    const himalayasConfig = this.config.himalayas;
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [latestRun, checkpoint, runs24h, failures24h, aggregates24h] = await Promise.all([
      this.prisma.ingestionRun.findFirst({
        where: { providerId: { in: ["himalayas.guid", "himalayas"] } },
        orderBy: { startedAt: "desc" }
      }),
      this.prisma.ingestionCheckpoint.findFirst({
        where: { providerId: { in: ["himalayas.guid", "himalayas"] } },
        orderBy: { updatedAt: "desc" }
      }),
      this.prisma.ingestionRun.count({
        where: {
          providerId: { in: ["himalayas.guid", "himalayas"] },
          startedAt: { gte: since24h }
        }
      }),
      this.prisma.ingestionRun.count({
        where: {
          providerId: { in: ["himalayas.guid", "himalayas"] },
          startedAt: { gte: since24h },
          status: "failed"
        }
      }),
      this.prisma.ingestionRun.aggregate({
        where: {
          providerId: { in: ["himalayas.guid", "himalayas"] },
          startedAt: { gte: since24h }
        },
        _sum: { recordsCreated: true }
      })
    ]);

    let status: "healthy" | "degraded" | "down" = "healthy";
    if (!latestRun) {
      status = "healthy";
    } else if (latestRun.status === "failed") {
      status = "down";
    } else if (failures24h > 0) {
      status = "degraded";
    }

    const himalayasSource: AdminSourceItem = {
      id: "himalayas",
      name: "Himalayas provider",
      kind: "REST API",
      region: "Global remote",
      status,
      enabled: himalayasConfig.enabled,
      cronSchedule: himalayasConfig.cron || null,
      lastRun: latestRun
        ? {
            id: latestRun.id,
            status: latestRun.status,
            startedAt: latestRun.startedAt.toISOString(),
            finishedAt: latestRun.finishedAt ? latestRun.finishedAt.toISOString() : null,
            recordsFetched: latestRun.recordsFetched,
            recordsCreated: latestRun.recordsCreated,
            recordsUpdated: latestRun.recordsUpdated,
            recordsExpired: latestRun.recordsExpired,
            stopReason: latestRun.stopReason
          }
        : null,
      checkpoint: checkpoint
        ? {
            mode: checkpoint.mode,
            updatedAt: checkpoint.updatedAt.toISOString(),
            cursor: checkpoint.cursor
          }
        : null,
      stats24h: {
        runs: runs24h,
        failures: failures24h,
        recordsCreated: aggregates24h._sum.recordsCreated ?? 0
      }
    };

    return { sources: [himalayasSource] };
  }

  async triggerSync(providerId: string, actorId: string): Promise<{ queued: boolean; jobId: string; providerId: string; enqueuedAt: string }> {
    const normalized = providerId.trim().toLowerCase();
    if (normalized !== "himalayas" && normalized !== "himalayas.guid") {
      throw new BadRequestException(`Provider '${providerId}' does not support manual sync or does not exist.`);
    }

    // Rate limit: 1 sync per 5 minutes (300 seconds) per provider
    await this.rateLimit.consume({
      namespace: "admin_provider_sync",
      subject: normalized,
      limit: 1,
      windowSeconds: 300
    });

    const job = await this.ingestionQueue.add(
      INGEST_HIMALAYAS_JOB,
      {
        providerId: "himalayas.guid",
        mode: "manual_admin",
        triggeredBy: actorId
      },
      {
        removeOnComplete: 25,
        removeOnFail: 50
      }
    );

    await this.prisma.auditEvent.create({
      data: {
        actorId,
        actorType: "ADMIN",
        action: "admin.source.sync_triggered",
        targetType: "Source",
        targetId: normalized,
        metadata: { bullJobId: job.id, providerId: normalized }
      }
    });

    this.logger.log(`Manual ingestion triggered for provider ${normalized} by admin ${actorId}, bullJobId=${job.id}`);

    return {
      queued: true,
      jobId: job.id ?? "unknown",
      providerId: normalized,
      enqueuedAt: new Date().toISOString()
    };
  }

  async getModerationQueue(query: AdminModerationQueueQueryDto) {
    const limit = query.limit ?? 20;
    const tab = query.tab ?? "all";

    const where: Prisma.JobWhereInput = {};

    if (tab === "suspicious") {
      where.OR = [{ status: JobStatus.SUSPICIOUS }, { moderationState: "flagged" }];
    } else if (tab === "stale") {
      where.status = JobStatus.STALE;
    } else if (tab === "expired") {
      where.status = JobStatus.EXPIRED;
    } else if (tab === "reports") {
      where.moderationState = "flagged";
    } else {
      // "all" problem jobs
      where.OR = [
        { status: JobStatus.SUSPICIOUS },
        { status: JobStatus.STALE },
        { status: JobStatus.EXPIRED },
        { moderationState: "flagged" }
      ];
    }

    const jobs = await this.prisma.job.findMany({
      where,
      take: limit + 1,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      skip: query.cursor ? 1 : 0,
      orderBy: [{ discoveredAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        slug: true,
        canonicalTitle: true,
        status: true,
        moderationState: true,
        workMode: true,
        remoteScope: true,
        publishedAt: true,
        discoveredAt: true,
        expiresAt: true,
        company: {
          select: {
            id: true,
            canonicalName: true,
            slug: true,
            logoUrl: true
          }
        },
        source: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        occurrences: {
          take: 1,
          select: {
            sourceUrl: true,
            applicationUrl: true,
            sourceName: true
          }
        }
      }
    });

    const hasMore = jobs.length > limit;
    const items = hasMore ? jobs.slice(0, limit) : jobs;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : null;

    const formatted = items.map((job) => {
      const occurrence = job.occurrences[0];
      let reason = "Flagged for review";
      let severity: "high" | "medium" = "medium";

      if (job.status === JobStatus.SUSPICIOUS) {
        reason = "Suspicious listing signals";
        severity = "high";
      } else if (job.moderationState === "flagged") {
        reason = "User/automated flag";
        severity = "high";
      } else if (job.status === JobStatus.EXPIRED) {
        reason = "Expired listing";
        severity = "medium";
      } else if (job.status === JobStatus.STALE) {
        reason = "Stale listing";
        severity = "medium";
      }

      return {
        id: job.id,
        slug: job.slug,
        title: job.canonicalTitle,
        status: job.status,
        moderationState: job.moderationState,
        severity,
        reason,
        company: job.company?.canonicalName ?? "Unknown Company",
        companySlug: job.company?.slug ?? null,
        companyLogoUrl: job.company?.logoUrl ?? null,
        provider: job.source?.name ?? occurrence?.sourceName ?? "Provider",
        location: job.remoteScope ? `Remote (${job.remoteScope})` : job.workMode,
        listingUrl: occurrence?.sourceUrl ?? occurrence?.applicationUrl ?? null,
        applicationUrl: occurrence?.applicationUrl ?? null,
        discoveredAt: job.discoveredAt.toISOString(),
        publishedAt: job.publishedAt ? job.publishedAt.toISOString() : null,
        expiresAt: job.expiresAt ? job.expiresAt.toISOString() : null
      };
    });

    return {
      items: formatted,
      nextCursor,
      hasMore
    };
  }

  async executeModerationAction(actorId: string, jobId: string, dto: AdminModerationActionDto) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        slug: true,
        status: true,
        moderationState: true,
        canonicalTitle: true
      }
    });

    if (!job) {
      throw new NotFoundException(`Job with ID '${jobId}' not found.`);
    }

    let nextStatus = job.status;
    let nextModerationState = job.moderationState;

    switch (dto.action) {
      case AdminModerationActionType.APPROVE:
        nextStatus = JobStatus.ACTIVE;
        nextModerationState = "approved";
        break;
      case AdminModerationActionType.EXPIRE:
        nextStatus = JobStatus.EXPIRED;
        break;
      case AdminModerationActionType.DISMISS:
        nextModerationState = "approved";
        if (job.status === JobStatus.SUSPICIOUS) {
          nextStatus = JobStatus.ACTIVE;
        }
        break;
      case AdminModerationActionType.REMOVE:
        nextStatus = JobStatus.EXPIRED;
        nextModerationState = "removed";
        break;
      default:
        throw new BadRequestException(`Unsupported moderation action '${dto.action}'.`);
    }

    const [updatedJob] = await this.prisma.$transaction([
      this.prisma.job.update({
        where: { id: jobId },
        data: {
          status: nextStatus,
          moderationState: nextModerationState
        },
        select: {
          id: true,
          slug: true,
          status: true,
          moderationState: true
        }
      }),
      this.prisma.auditEvent.create({
        data: {
          actorId,
          actorType: "ADMIN",
          action: `admin.moderation.${dto.action.toLowerCase()}`,
          targetType: "Job",
          targetId: jobId,
          metadata: {
            previousStatus: job.status,
            previousModerationState: job.moderationState,
            nextStatus,
            nextModerationState,
            notes: dto.notes ? dto.notes.slice(0, 500) : null
          }
        }
      })
    ]);

    this.logger.log(
      `Moderation action ${dto.action} executed on job ${jobId} (${job.slug}) by admin ${actorId}. Status: ${job.status}->${nextStatus}, ModerationState: ${job.moderationState}->${nextModerationState}`
    );

    return {
      success: true,
      job: updatedJob,
      action: dto.action
    };
  }
}
