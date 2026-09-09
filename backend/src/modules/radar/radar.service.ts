import { GoneException, Injectable } from "@nestjs/common";
import { ApplicationLifecycle } from "@prisma/client";
import { AppConfigService } from "../../common/config/app-config.service";
import { PrismaService } from "../../prisma/prisma.service";
import { EligibilityService } from "../eligibility/eligibility.service";
import { JobsService } from "../jobs/jobs.service";
import { MatchBriefsService } from "../matching/match-briefs.service";
import { RadarFeedQueryDto } from "./dto/radar-feed-query.dto";
import { decodeRadarCursor, encodeRadarCursor, radarQueryKey } from "./radar-cursor.util";
import { RadarCacheService } from "./radar-cache.service";
import { RadarQueryService } from "./radar-query.service";
import { RadarRankingService } from "./radar-ranking.service";
import {
  RADAR_ENRICHMENT_LIMIT,
  RADAR_ENGINE_VERSION,
  RADAR_EVALUATION_CHUNK_SIZE,
  RADAR_SNAPSHOT_TTL_SECONDS,
  RadarSnapshot,
  RadarSnapshotItem
} from "./radar.types";

@Injectable()
export class RadarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly jobs: JobsService,
    private readonly queryService: RadarQueryService,
    private readonly cache: RadarCacheService,
    private readonly ranking: RadarRankingService,
    private readonly matchBriefs: MatchBriefsService,
    private readonly eligibility: EligibilityService
  ) {}

  async feed(userId: string, query: RadarFeedQueryDto) {
    const queryKey = radarQueryKey(this.queryPayload(query));
    const limit = query.limit;
    const snapshot = query.cursor
      ? await this.loadSnapshotFromCursor(userId, query.cursor, queryKey)
      : await this.createSnapshot(userId, query, queryKey);

    const startIndex = query.cursor ? this.nextIndexFromCursor(query.cursor, snapshot) : 0;
    const pageItems = snapshot.items.slice(startIndex, startIndex + limit);
    const snapshotCanPage = snapshot.cacheStored !== false;
    const hasNextPage = snapshotCanPage && startIndex + limit < snapshot.items.length;
    const nextCursor = hasNextPage
      ? encodeRadarCursor(
          {
            v: 1,
            engineVersion: RADAR_ENGINE_VERSION,
            userId,
            profileRevision: snapshot.profileRevision,
            feedSnapshotId: snapshot.feedSnapshotId,
            queryKey,
            expiresAt: snapshot.expiresAt,
            last: {
              jobId: pageItems[pageItems.length - 1].id,
              rank: pageItems[pageItems.length - 1].rank
            }
          },
          this.config.cursorSigningSecret
        )
      : null;

    const page = await this.hydratePage(userId, pageItems);
    const summaryResult = await this.safeSummary(userId, snapshot);
    const warnings = [
      ...(snapshot.warnings ?? []),
      ...page.warnings,
      ...summaryResult.warnings,
      ...(snapshot.cacheStored === false ? ["RADAR_SNAPSHOT_CACHE_UNAVAILABLE"] : [])
    ];

    return {
      data: page.data,
      pageInfo: {
        feedSnapshotId: snapshot.feedSnapshotId,
        nextCursor,
        hasNextPage,
        expiresAt: snapshot.expiresAt
      },
      summary: summaryResult.summary,
      candidateCounts: snapshot.candidateCounts,
      warnings: Array.from(new Set(warnings))
    };
  }

  async summary(userId: string, snapshot?: RadarSnapshot) {
    const now = new Date();
    const next14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const [savedJobs, activeApplications, upcomingActions] = await Promise.all([
      this.prisma.savedItem.count({ where: { userId, itemType: "JOB" } }),
      this.prisma.application.count({ where: { userId, lifecycle: ApplicationLifecycle.ACTIVE } }),
      this.prisma.application.findMany({
        where: {
          userId,
          lifecycle: ApplicationLifecycle.ACTIVE,
          nextActionAt: { gt: now, lte: next14Days }
        },
        orderBy: [{ nextActionAt: "asc" }, { id: "asc" }],
        take: 10,
        select: {
          id: true,
          roleTitle: true,
          companyName: true,
          nextAction: true,
          nextActionAt: true,
          jobSlug: true
        }
      })
    ]);

    const snapshotItems = snapshot?.items ?? [];
    const newRadarRoles = snapshotItems.filter((item) => new Date(item.ranking.firstSeenAt) >= sevenDaysAgo).length;
    const employerDeadlines = snapshotItems
      .filter((item) => item.ranking.deadlineAt && new Date(item.ranking.deadlineAt).getTime() > now.getTime())
      .sort((a, b) => Date.parse(a.ranking.deadlineAt!) - Date.parse(b.ranking.deadlineAt!))
      .slice(0, 5)
      .map((item) => ({
        slug: item.slug,
        rank: item.rank,
        deadlineAt: item.ranking.deadlineAt
      }));

    return {
      savedJobs,
      activeApplications,
      upcomingActions: upcomingActions.map((action) => ({
        ...action,
        nextActionAt: action.nextActionAt?.toISOString() ?? null
      })),
      newRadarRoles,
      employerDeadlines
    };
  }

  private async createSnapshot(userId: string, query: RadarFeedQueryDto, queryKey: string): Promise<RadarSnapshot> {
    const snapshotAsOf = new Date();
    const warnings: string[] = [];
    const profile = await this.queryService.profileSnapshot(userId);
    const candidates = await this.queryService.generateCandidates(userId, query, snapshotAsOf);
    const enrichmentCandidates = this.ranking.preOrder(candidates, RADAR_ENRICHMENT_LIMIT);
    const snapshotTracked = await this.safeActiveTrackedSlugs(userId, enrichmentCandidates.map((candidate) => candidate.slug));
    if (snapshotTracked.unknown) warnings.push("RADAR_TRACKER_STATE_UNAVAILABLE");
    const slugs = enrichmentCandidates.map((candidate) => candidate.slug);
    const [matchBriefs, eligibility] = await Promise.all([
      this.safeChunked("RADAR_MATCH_BRIEF_UNAVAILABLE", slugs, (chunk) => this.matchBriefs.evaluateBatch(userId, chunk)),
      this.safeChunked("RADAR_ELIGIBILITY_UNAVAILABLE", slugs, (chunk) => this.eligibility.evaluateBatch(userId, chunk))
    ]);
    warnings.push(...matchBriefs.warnings, ...eligibility.warnings);

    const matchMap = new Map(matchBriefs.data.flat().map((summary) => [summary.jobSlug, summary]));
    const eligibilityMap = new Map(eligibility.data.flat().map((summary) => [summary.slug, summary]));
    const filtered = enrichmentCandidates.filter((candidate) => {
      const matchState = matchMap.get(candidate.slug)?.status ?? "NOT_CALCULATED";
      if (query.alignment?.length && !query.alignment.includes(matchState)) return false;
      if (query.eligibility !== "NO_KNOWN_CONFLICTS") return true;
      const state = eligibilityMap.get(candidate.slug)?.overallStatus;
      return state === "APPEARS_ELIGIBLE" || state === "LIKELY_ELIGIBLE";
    });
    const ranked = this.ranking.rank({
      candidates: filtered,
      matchBriefs: matchMap,
      eligibility: eligibilityMap,
      trackedAtSnapshot: snapshotTracked.slugs,
      preference: {
        workMode: profile?.preferences?.remotePreference ? String(profile.preferences.remotePreference) : null,
        employmentTypes: profile?.preferences?.employmentTypes?.map(String) ?? []
      },
      sort: query.sort
    });

    const createdAt = snapshotAsOf.toISOString();
    const expiresAt = new Date(snapshotAsOf.getTime() + RADAR_SNAPSHOT_TTL_SECONDS * 1000).toISOString();
    const snapshot: RadarSnapshot = {
      v: 1,
      engineVersion: RADAR_ENGINE_VERSION,
      feedSnapshotId: this.cache.createSnapshotId(),
      userId,
      profileRevision: profile?.revision ?? 0,
      createdAt,
      expiresAt,
      queryKey,
      filters: this.queryPayload(query),
      candidateCounts: {
        sqlCandidates: candidates.length,
        enrichmentCandidates: enrichmentCandidates.length,
        ranked: ranked.length
      },
      warnings,
      items: ranked
    };
    snapshot.cacheStored = await this.cache.set(snapshot);
    return snapshot;
  }

  private async loadSnapshotFromCursor(userId: string, cursor: string, queryKey: string): Promise<RadarSnapshot> {
    const payload = decodeRadarCursor(cursor, this.config.cursorSigningSecret);
    if (payload.userId !== userId || payload.queryKey !== queryKey || payload.engineVersion !== RADAR_ENGINE_VERSION) {
      throw new GoneException({
        code: "FEED_SNAPSHOT_EXPIRED",
        message: "Radar feed snapshot expired. Refresh from the first page."
      });
    }
    const snapshot = await this.cache.get(payload.feedSnapshotId);
    if (!snapshot || snapshot.userId !== userId || snapshot.queryKey !== queryKey) {
      throw new GoneException({
        code: "FEED_SNAPSHOT_EXPIRED",
        message: "Radar feed snapshot expired. Refresh from the first page."
      });
    }
    return snapshot;
  }

  private nextIndexFromCursor(cursor: string, snapshot: RadarSnapshot): number {
    const payload = decodeRadarCursor(cursor, this.config.cursorSigningSecret);
    const index = snapshot.items.findIndex((item) => item.id === payload.last.jobId && item.rank === payload.last.rank);
    if (index < 0) {
      throw new GoneException({
        code: "FEED_SNAPSHOT_EXPIRED",
        message: "Radar feed snapshot expired. Refresh from the first page."
      });
    }
    return index + 1;
  }

  private async hydratePage(userId: string, items: RadarSnapshotItem[]) {
    if (items.length === 0) return { data: [], warnings: [] };
    const ids = items.map((item) => item.id);
    const slugs = items.map((item) => item.slug);
    const [jobs, savedSlugs, trackedSlugs] = await Promise.all([
      this.prisma.job.findMany({ where: { id: { in: ids } }, include: this.jobs.include() }),
      this.safeSavedSlugs(userId, slugs),
      this.safeActiveTrackedSlugs(userId, slugs)
    ]);
    const warnings = [
      ...(savedSlugs.unknown ? ["RADAR_SAVED_STATE_UNAVAILABLE"] : []),
      ...(trackedSlugs.unknown ? ["RADAR_TRACKER_STATE_UNAVAILABLE"] : [])
    ];
    const jobMap = new Map(jobs.map((job) => [job.id, job]));
    const data = items
      .map((item) => {
        const job = jobMap.get(item.id);
        if (!job) return null;
        return {
          job: this.jobs.serialize(job, { isDetail: false }),
          rank: item.rank,
          reasonCodes: item.reasonCodes,
          matchBrief: item.matchBrief,
          eligibility: item.eligibility,
          jobAvailability: item.jobAvailability,
          saved: savedSlugs.unknown ? null : savedSlugs.slugs.has(item.slug),
          tracked: trackedSlugs.unknown ? null : trackedSlugs.slugs.has(item.slug)
        };
      })
      .filter(Boolean);
    return { data, warnings };
  }

  private async safeSavedSlugs(userId: string, slugs: string[]) {
    try {
      const rows = await this.prisma.savedItem.findMany({
        where: { userId, itemType: "JOB", itemId: { in: slugs } },
        select: { itemId: true }
      });
      return { slugs: new Set(rows.map((row) => row.itemId)), unknown: false };
    } catch {
      return { slugs: new Set<string>(), unknown: true };
    }
  }

  private async safeActiveTrackedSlugs(userId: string, slugs: string[]) {
    try {
      const rows = await this.prisma.application.findMany({
        where: {
          userId,
          lifecycle: ApplicationLifecycle.ACTIVE,
          OR: [{ jobSlug: { in: slugs } }, { job: { slug: { in: slugs } } }]
        },
        select: { jobSlug: true, job: { select: { slug: true } } }
      });
      return {
        slugs: new Set(rows.map((row) => row.jobSlug ?? row.job?.slug).filter((slug): slug is string => Boolean(slug))),
        unknown: false
      };
    } catch {
      return { slugs: new Set<string>(), unknown: true };
    }
  }

  private async chunked<T>(slugs: string[], fn: (chunk: string[]) => Promise<T[]>): Promise<T[][]> {
    const batches: Promise<T[]>[] = [];
    for (let index = 0; index < slugs.length; index += RADAR_EVALUATION_CHUNK_SIZE) {
      batches.push(fn(slugs.slice(index, index + RADAR_EVALUATION_CHUNK_SIZE)));
    }
    return Promise.all(batches);
  }

  private async safeChunked<T>(warning: string, slugs: string[], fn: (chunk: string[]) => Promise<T[]>): Promise<{ data: T[][]; warnings: string[] }> {
    try {
      return { data: await this.chunked(slugs, fn), warnings: [] };
    } catch {
      return { data: [], warnings: [warning] };
    }
  }

  private async safeSummary(userId: string, snapshot: RadarSnapshot) {
    try {
      return { summary: await this.summary(userId, snapshot), warnings: [] };
    } catch {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return {
        summary: {
          savedJobs: null,
          activeApplications: null,
          upcomingActions: [],
          newRadarRoles: snapshot.items.filter((item) => new Date(item.ranking.firstSeenAt) >= sevenDaysAgo).length,
          employerDeadlines: []
        },
        warnings: ["RADAR_SUMMARY_UNAVAILABLE"]
      };
    }
  }

  private queryPayload(query: RadarFeedQueryDto): Record<string, unknown> {
    return {
      sort: query.sort ?? "relevance",
      eligibility: query.eligibility ?? "INCLUDE_ALL",
      tracked: query.tracked ?? "include",
      alignment: query.alignment ?? [],
      workMode: query.workMode ?? [],
      employmentType: query.employmentType ?? [],
      country: query.country ?? [],
      provider: query.provider ?? [],
      salaryDisclosed: query.salaryDisclosed ?? null,
      freshnessWindow: query.freshnessWindow ?? null
    };
  }
}
