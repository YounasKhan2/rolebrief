import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { ApplicationLifecycle, ApplicationStage, Prisma } from "@prisma/client";
import { AppConfigService } from "../../common/config/app-config.service";
import { PrismaService } from "../../prisma/prisma.service";
import { JobsService } from "../jobs/jobs.service";
import {
  CreateApplicationDto,
  TrackerQueryDto,
  UpdateApplicationDto
} from "./dto/tracker.dto";
import {
  decodeTrackerCursor,
  encodeTrackerCursor
} from "./tracker-cursor.util";

export const ALLOWED_STAGE_TRANSITIONS: Record<ApplicationStage, ApplicationStage[]> = {
  SAVED: [ApplicationStage.APPLIED, ApplicationStage.WITHDRAWN],
  APPLIED: [
    ApplicationStage.SAVED,
    ApplicationStage.INTERVIEWING,
    ApplicationStage.REJECTED,
    ApplicationStage.WITHDRAWN
  ],
  INTERVIEWING: [
    ApplicationStage.APPLIED,
    ApplicationStage.OFFER,
    ApplicationStage.REJECTED,
    ApplicationStage.WITHDRAWN
  ],
  OFFER: [
    ApplicationStage.INTERVIEWING,
    ApplicationStage.REJECTED,
    ApplicationStage.WITHDRAWN
  ],
  REJECTED: [ApplicationStage.APPLIED, ApplicationStage.INTERVIEWING],
  WITHDRAWN: [ApplicationStage.SAVED, ApplicationStage.APPLIED]
};

@Injectable()
export class TrackerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobsService: JobsService,
    private readonly config: AppConfigService
  ) {}

  public validateTransition(from: ApplicationStage, to: ApplicationStage): boolean {
    if (from === to) return true;
    const allowed = ALLOWED_STAGE_TRANSITIONS[from];
    return allowed?.includes(to) ?? false;
  }

  async list(userId: string, query: TrackerQueryDto = new TrackerQueryDto()) {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 50);
    const lifecycle = query.lifecycle ?? ApplicationLifecycle.ACTIVE;
    const stage = query.stage;

    // 1. Calculate stageCounts across all active applications of the user
    const activeGroupCounts = await this.prisma.application.groupBy({
      by: ["stage"],
      where: {
        userId,
        lifecycle: ApplicationLifecycle.ACTIVE
      },
      _count: {
        _all: true
      }
    });

    const stageCounts: Record<ApplicationStage, number> = {
      SAVED: 0,
      APPLIED: 0,
      INTERVIEWING: 0,
      OFFER: 0,
      REJECTED: 0,
      WITHDRAWN: 0
    };

    for (const group of activeGroupCounts) {
      stageCounts[group.stage] = group._count._all;
    }

    // 2. Decode cursor if present and construct tuple keyset boundary
    let cursorBoundary: Prisma.ApplicationWhereInput | undefined;
    if (query.cursor) {
      const decoded = decodeTrackerCursor(
        query.cursor,
        this.config.cursorSigningSecret,
        userId,
        stage || "",
        lifecycle || ""
      );
      const cursorDate = new Date(decoded.updatedAt);
      cursorBoundary = {
        OR: [
          { updatedAt: { lt: cursorDate } },
          {
            updatedAt: cursorDate,
            id: { lt: decoded.id }
          }
        ]
      };
    }

    // 3. Paginated list query with keyset boundary
    const where: Prisma.ApplicationWhereInput = {
      userId,
      lifecycle,
      ...(stage ? { stage } : {}),
      ...(cursorBoundary ? cursorBoundary : {})
    };

    const [totalCount, items] = await Promise.all([
      this.prisma.application.count({
        where: {
          userId,
          lifecycle,
          ...(stage ? { stage } : {})
        }
      }),
      this.prisma.application.findMany({
        where,
        take: limit + 1,
        orderBy: [
          { updatedAt: "desc" },
          { id: "desc" }
        ],
        include: {
          job: {
            select: {
              id: true,
              slug: true,
              status: true,
              expiresAt: true,
              company: {
                select: {
                  canonicalName: true,
                  logoUrl: true
                }
              }
            }
          },
          history: {
            take: 5,
            orderBy: { occurredAt: "desc" }
          }
        }
      })
    ]);

    const hasNextPage = items.length > limit;
    const pageItems = hasNextPage ? items.slice(0, limit) : items;
    let nextCursor: string | null = null;
    if (hasNextPage && pageItems.length > 0) {
      const last = pageItems[pageItems.length - 1];
      nextCursor = encodeTrackerCursor(
        {
          v: 1,
          userId,
          stageFilter: stage || "",
          lifecycleFilter: lifecycle || "",
          updatedAt: last.updatedAt.toISOString(),
          id: last.id
        },
        this.config.cursorSigningSecret
      );
    }

    const data = pageItems.map((app) => this.serialize(app));

    return {
      data,
      stageCounts,
      pageInfo: {
        nextCursor,
        hasNextPage
      },
      totalCount
    };
  }

  async getById(userId: string, id: string) {
    const app = await this.prisma.application.findFirst({
      where: { id, userId },
      include: {
        job: {
          select: {
            id: true,
            slug: true,
            status: true,
            expiresAt: true,
            company: {
              select: {
                canonicalName: true,
                logoUrl: true
              }
            }
          }
        },
        history: {
          orderBy: { occurredAt: "desc" }
        }
      }
    });

    if (!app) {
      throw new NotFoundException(`Application "${id}" not found`);
    }

    return this.serialize(app);
  }

  async create(userId: string, dto: CreateApplicationDto) {
    let jobId: string | null = null;
    let roleTitle = dto.roleTitle?.trim();
    let companyName = dto.companyName?.trim() || null;
    let jobSlug: string | null = null;
    let providerName: string | null = null;
    let applicationUrl: string | null = null;
    let locationLabel: string | null = null;
    let workMode: string | null = null;
    let employerDeadlineAt: Date | null = null;

    if (dto.jobSlug) {
      const job = await this.prisma.job.findUnique({
        where: { slug: dto.jobSlug },
        include: {
          company: true,
          source: true,
          locations: { include: { location: true } },
          providerRecords: true
        }
      });

      if (!job) {
        throw new NotFoundException(`Job with slug "${dto.jobSlug}" not found`);
      }

      jobId = job.id;
      jobSlug = job.slug;
      roleTitle = roleTitle || job.canonicalTitle;
      companyName = companyName || job.company?.canonicalName || null;
      providerName = job.source?.name || "Himalayas";
      applicationUrl = job.providerRecords[0]?.applicationUrl || job.providerRecords[0]?.sourceUrl || null;
      workMode = job.workMode;
      locationLabel = job.locations.length > 0 ? job.locations.map((l) => l.location.name).join(", ") : null;
      employerDeadlineAt = job.applicationDeadlineAt || null;

      // Idempotency check: if user already tracks this job
      const existing = await this.prisma.application.findUnique({
        where: {
          userId_jobId: {
            userId,
            jobId: job.id
          }
        },
        include: {
          job: {
            select: {
              id: true,
              slug: true,
              status: true,
              expiresAt: true,
              company: { select: { canonicalName: true, logoUrl: true } }
            }
          },
          history: { orderBy: { occurredAt: "desc" } }
        }
      });

      if (existing) {
        if (existing.lifecycle === ApplicationLifecycle.ARCHIVED) {
          const restored = await this.prisma.$transaction(async (tx) => {
            const updated = await tx.application.update({
              where: { id: existing.id },
              data: {
                lifecycle: ApplicationLifecycle.ACTIVE,
                revision: { increment: 1 }
              },
              include: {
                job: {
                  select: {
                    id: true,
                    slug: true,
                    status: true,
                    expiresAt: true,
                    company: { select: { canonicalName: true, logoUrl: true } }
                  }
                },
                history: { orderBy: { occurredAt: "desc" } }
              }
            });

            await tx.applicationHistory.create({
              data: {
                applicationId: existing.id,
                fromStage: existing.stage,
                toStage: existing.stage,
                note: "Restored from archive by re-tracking"
              }
            });

            return updated;
          });

          return {
            ...this.serialize(restored),
            alreadyTracked: false,
            restored: true
          };
        }

        return {
          ...this.serialize(existing),
          alreadyTracked: true,
          restored: false
        };
      }
    }

    if (!roleTitle) {
      throw new BadRequestException("roleTitle is required for manual applications");
    }

    const initialStage = dto.stage || ApplicationStage.SAVED;
    const appliedAt = dto.appliedAt
      ? new Date(dto.appliedAt)
      : initialStage === ApplicationStage.APPLIED
        ? new Date()
        : null;

    const created = await this.prisma.$transaction(async (tx) => {
      const app = await tx.application.create({
        data: {
          userId,
          jobId,
          roleTitle,
          companyName,
          jobSlug,
          providerName,
          applicationUrl: dto.applicationUrl || applicationUrl || null,
          locationLabel,
          workMode,
          employerDeadlineAt,
          sourceUrl: dto.sourceUrl || null,
          sourceLabel: dto.sourceLabel || null,
          contactName: dto.contactName || null,
          contactEmail: dto.contactEmail || null,
          stage: initialStage,
          appliedAt,
          nextAction: dto.nextAction || null,
          nextActionAt: dto.nextActionAt ? new Date(dto.nextActionAt) : null,
          notes: dto.notes || null,
          reminderAt: dto.reminderAt ? new Date(dto.reminderAt) : null,
          interviewAt: dto.interviewAt ? new Date(dto.interviewAt) : null
        }
      });

      await tx.applicationHistory.create({
        data: {
          applicationId: app.id,
          fromStage: null,
          toStage: initialStage,
          note: dto.jobSlug ? "Tracked from discovered role" : "Added manual application"
        }
      });

      return tx.application.findUniqueOrThrow({
        where: { id: app.id },
        include: {
          history: { orderBy: { occurredAt: "desc" } }
        }
      });
    });

    return {
      ...this.serialize(created),
      alreadyTracked: false,
      restored: false
    };
  }

  async update(userId: string, id: string, dto: UpdateApplicationDto) {
    const current = await this.prisma.application.findFirst({
      where: { id, userId }
    });

    if (!current) {
      throw new NotFoundException(`Application "${id}" not found`);
    }

    if (current.revision !== dto.expectedRevision) {
      const latest = await this.getById(userId, id);
      throw new ConflictException({
        message: "Stale application update conflict. The record has been modified by another action.",
        currentRevision: current.revision,
        currentState: latest
      });
    }

    const stageChanging = dto.stage && dto.stage !== current.stage;
    if (stageChanging && !this.validateTransition(current.stage, dto.stage!)) {
      throw new BadRequestException(
        `Invalid stage transition from ${current.stage} to ${dto.stage}. Allowed transitions: ${ALLOWED_STAGE_TRANSITIONS[current.stage]?.join(", ") || "none"}`
      );
    }

    const updateData: Prisma.ApplicationUpdateInput = {
      revision: { increment: 1 }
    };

    if (dto.stage !== undefined) updateData.stage = dto.stage;
    if (dto.lifecycle !== undefined) updateData.lifecycle = dto.lifecycle;
    if (dto.roleTitle !== undefined) updateData.roleTitle = dto.roleTitle.trim();
    if (dto.companyName !== undefined) updateData.companyName = dto.companyName ? dto.companyName.trim() : null;
    if (dto.appliedAt !== undefined) updateData.appliedAt = dto.appliedAt ? new Date(dto.appliedAt) : null;
    if (dto.nextAction !== undefined) updateData.nextAction = dto.nextAction ? dto.nextAction.trim() : null;
    if (dto.nextActionAt !== undefined) updateData.nextActionAt = dto.nextActionAt ? new Date(dto.nextActionAt) : null;
    if (dto.notes !== undefined) updateData.notes = dto.notes ? dto.notes.trim() : null;
    if (dto.reminderAt !== undefined) updateData.reminderAt = dto.reminderAt ? new Date(dto.reminderAt) : null;
    if (dto.interviewAt !== undefined) updateData.interviewAt = dto.interviewAt ? new Date(dto.interviewAt) : null;
    if (dto.sourceUrl !== undefined) updateData.sourceUrl = dto.sourceUrl;
    if (dto.sourceLabel !== undefined) updateData.sourceLabel = dto.sourceLabel;
    if (dto.applicationUrl !== undefined) updateData.applicationUrl = dto.applicationUrl;
    if (dto.contactName !== undefined) updateData.contactName = dto.contactName;
    if (dto.contactEmail !== undefined) updateData.contactEmail = dto.contactEmail;

    const lifecycleChanging = dto.lifecycle && dto.lifecycle !== current.lifecycle;

    const result = await this.prisma.$transaction(async (tx) => {
      const res = await tx.application.updateMany({
        where: {
          id,
          userId,
          revision: dto.expectedRevision
        },
        data: updateData
      });

      if (res.count === 0) {
        throw new ConflictException({
          message: "Stale application update conflict. The record has been modified.",
          currentRevision: current.revision
        });
      }

      if (stageChanging) {
        await tx.applicationHistory.create({
          data: {
            applicationId: id,
            fromStage: current.stage,
            toStage: dto.stage!,
            note: dto.stageChangeNote || `Moved from ${current.stage} to ${dto.stage}`
          }
        });
      }

      if (lifecycleChanging) {
        await tx.applicationHistory.create({
          data: {
            applicationId: id,
            fromStage: current.stage,
            toStage: dto.stage || current.stage,
            note: dto.lifecycle === ApplicationLifecycle.ARCHIVED ? "Archived application" : "Restored application to active"
          }
        });
      }

      return tx.application.findUniqueOrThrow({
        where: { id },
        include: {
          job: {
            select: {
              id: true,
              slug: true,
              status: true,
              expiresAt: true,
              company: { select: { canonicalName: true, logoUrl: true } }
            }
          },
          history: { orderBy: { occurredAt: "desc" } }
        }
      });
    });

    return this.serialize(result);
  }

  async archive(userId: string, id: string, expectedRevision: number) {
    return this.update(userId, id, {
      expectedRevision,
      lifecycle: ApplicationLifecycle.ARCHIVED
    });
  }

  async restore(userId: string, id: string, expectedRevision: number) {
    return this.update(userId, id, {
      expectedRevision,
      lifecycle: ApplicationLifecycle.ACTIVE
    });
  }

  async delete(userId: string, id: string, expectedRevision: number) {
    const current = await this.prisma.application.findFirst({
      where: { id, userId }
    });

    if (!current) {
      throw new NotFoundException(`Application "${id}" not found`);
    }

    if (current.revision !== expectedRevision) {
      throw new ConflictException({
        message: "Stale application delete conflict.",
        currentRevision: current.revision
      });
    }

    const res = await this.prisma.application.deleteMany({
      where: {
        id,
        userId,
        revision: expectedRevision
      }
    });

    if (res.count === 0) {
      throw new ConflictException("Stale application delete conflict");
    }

    return { success: true, id };
  }

  private serialize(app: any) {
    const isJobExpired = Boolean(
      app.job &&
        (app.job.status === "EXPIRED" ||
          (app.job.expiresAt ? new Date(app.job.expiresAt).getTime() < Date.now() : false))
    );

    return {
      id: app.id,
      jobId: app.jobId,
      jobSlug: app.jobSlug,
      roleTitle: app.roleTitle,
      companyName: app.companyName,
      companyLogoUrl: app.job?.company?.logoUrl || null,
      providerName: app.providerName,
      applicationUrl: app.applicationUrl,
      locationLabel: app.locationLabel,
      workMode: app.workMode,
      employerDeadlineAt: app.employerDeadlineAt ? app.employerDeadlineAt.toISOString() : null,
      sourceUrl: app.sourceUrl,
      sourceLabel: app.sourceLabel,
      contactName: app.contactName,
      contactEmail: app.contactEmail,
      stage: app.stage,
      lifecycle: app.lifecycle,
      nextAction: app.nextAction,
      nextActionAt: app.nextActionAt ? app.nextActionAt.toISOString() : null,
      notes: app.notes,
      appliedAt: app.appliedAt ? app.appliedAt.toISOString() : null,
      reminderAt: app.reminderAt ? app.reminderAt.toISOString() : null,
      interviewAt: app.interviewAt ? app.interviewAt.toISOString() : null,
      revision: app.revision,
      isJobExpired,
      createdAt: app.createdAt instanceof Date ? app.createdAt.toISOString() : (app.createdAt ? String(app.createdAt) : new Date().toISOString()),
      updatedAt: app.updatedAt instanceof Date ? app.updatedAt.toISOString() : (app.updatedAt ? String(app.updatedAt) : new Date().toISOString()),
      history: app.history
        ? app.history.map((h: any) => ({
            id: h.id,
            fromStage: h.fromStage,
            toStage: h.toStage,
            note: h.note,
            occurredAt: h.occurredAt instanceof Date ? h.occurredAt.toISOString() : (h.occurredAt ? String(h.occurredAt) : new Date().toISOString())
          }))
        : []
    };
  }
}
