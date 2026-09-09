import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import Redis from "ioredis";
import { AppConfigService } from "../../common/config/app-config.service";
import { PrismaService } from "../../prisma/prisma.service";
import { computeJobMatchVersion } from "./job-match-version";
import { CandidateMatchFacts, JobMatchFacts } from "./match-brief.types";
import { MatchBriefEvaluatorService } from "./match-brief-evaluator.service";
import { MatchBriefDetail, MatchBriefSummary } from "./reason-codes";
import { MATCH_BRIEF_ENGINE_VERSION, MATCH_BRIEF_TAXONOMY_VERSION } from "./title-taxonomy";

const CACHE_TTL_SECONDS = 1800;

@Injectable()
export class MatchBriefsService implements OnModuleDestroy {
  private readonly logger = new Logger(MatchBriefsService.name);
  private readonly redis: Redis | null;
  private redisDisabled = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly evaluator: MatchBriefEvaluatorService
  ) {
    try {
      this.redis = new Redis(config.redisUrl, {
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
        lazyConnect: true
      });
      this.redis.on("error", (err) => {
        if (!this.redisDisabled) {
          this.logger.warn(`Redis connection error in MatchBriefsService, computing without cache: ${err.message}`);
          this.redisDisabled = true;
        }
      });
    } catch (err: any) {
      this.redis = null;
      this.redisDisabled = true;
      this.logger.warn(`Failed to initialize Redis in MatchBriefsService: ${err.message}`);
    }
  }

  async onModuleDestroy() {
    await this.redis?.quit().catch(() => undefined);
  }

  async evaluateBatch(userId: string, slugs: string[]): Promise<MatchBriefSummary[]> {
    this.validateUniqueSlugs(slugs);
    if (slugs.length === 0) return [];
    const candidate = await this.getCandidateFacts(userId);
    const jobs = await this.prisma.job.findMany({
      where: { slug: { in: slugs } },
      include: { salaries: true }
    });
    const jobMap = new Map(jobs.map((job) => [job.slug, this.toJobFacts(job)]));
    const cacheKeys = new Map<string, string>();
    for (const [slug, job] of jobMap.entries()) {
      cacheKeys.set(slug, this.cacheKey("summary", userId, candidate.revision, job));
    }

    const summaries = new Map<string, MatchBriefSummary>();
    const misses: JobMatchFacts[] = [];
    await this.readSummaryCache(cacheKeys, summaries, misses, jobMap);

    const cacheWrites = new Map<string, MatchBriefSummary>();
    for (const job of misses) {
      const detail = this.evaluator.evaluate(candidate, job);
      const summary = this.evaluator.summarize(detail);
      summaries.set(job.slug, summary);
      cacheWrites.set(this.cacheKey("summary", userId, candidate.revision, job), summary);
    }
    await this.writeCache(cacheWrites);

    return slugs.map((slug) => summaries.get(slug)).filter((summary): summary is MatchBriefSummary => Boolean(summary));
  }

  async evaluateJob(userId: string, slug: string): Promise<MatchBriefDetail> {
    const candidate = await this.getCandidateFacts(userId);
    const job = await this.prisma.job.findUnique({
      where: { slug },
      include: { salaries: true }
    });
    if (!job) throw new NotFoundException("Job not found");
    const facts = this.toJobFacts(job);
    const key = this.cacheKey("detail", userId, candidate.revision, facts);
    const cached = await this.readDetailCache(key);
    if (cached) return cached;
    const detail = this.evaluator.evaluate(candidate, facts);
    await this.writeCache(new Map([[key, detail]]));
    return detail;
  }

  private async getCandidateFacts(userId: string): Promise<CandidateMatchFacts> {
    const profile = await this.prisma.candidateProfile.findUnique({
      where: { userId },
      include: { preferences: true }
    });
    return {
      userId,
      revision: profile?.revision ?? 0,
      targetRoleTitles: profile?.preferences?.targetRoleTitles ?? [],
      seniorityLevel: profile?.seniorityLevel ?? null,
      remotePreference: profile?.preferences?.remotePreference ?? null,
      employmentTypes: profile?.preferences?.employmentTypes ?? [],
      minSalary: profile?.preferences?.minSalary ?? null,
      maxSalary: profile?.preferences?.maxSalary ?? null,
      salaryCurrency: profile?.preferences?.salaryCurrency ?? null,
      salaryPeriod: profile?.preferences?.salaryPeriod ?? null
    };
  }

  private toJobFacts(job: Prisma.JobGetPayload<{ include: { salaries: true } }>): JobMatchFacts {
    const salary = job.salaries[0];
    return {
      id: job.id,
      slug: job.slug,
      title: job.canonicalTitle,
      seniority: job.seniority,
      employmentType: job.employmentType,
      workMode: job.workMode,
      salary: salary
        ? {
            min: salary.min,
            max: salary.max,
            currency: salary.currency,
            period: salary.period
          }
        : null
    };
  }

  private validateUniqueSlugs(slugs: string[]) {
    if (new Set(slugs).size !== slugs.length) {
      throw new BadRequestException("Duplicate job slugs are not allowed.");
    }
  }

  private cacheKey(kind: "summary" | "detail", userId: string, revision: number, job: JobMatchFacts) {
    return `match:${kind}:${MATCH_BRIEF_ENGINE_VERSION}:${MATCH_BRIEF_TAXONOMY_VERSION}:${userId}:${revision}:${job.id}:${computeJobMatchVersion(job)}`;
  }

  private async readSummaryCache(
    cacheKeys: Map<string, string>,
    summaries: Map<string, MatchBriefSummary>,
    misses: JobMatchFacts[],
    jobMap: Map<string, JobMatchFacts>
  ) {
    if (!this.redis || this.redisDisabled || cacheKeys.size === 0) {
      misses.push(...jobMap.values());
      return;
    }
    try {
      const entries = Array.from(cacheKeys.entries());
      const values = await this.redis.mget(entries.map(([, key]) => key));
      entries.forEach(([slug], index) => {
        const cached = values[index];
        if (cached) {
          try {
            summaries.set(slug, JSON.parse(cached));
            return;
          } catch {
            // Fall through to recompute malformed cache values.
          }
        }
        const job = jobMap.get(slug);
        if (job) misses.push(job);
      });
    } catch (err: any) {
      this.logger.warn(`Redis MGET failed for Match Briefs: ${err.message}`);
      misses.push(...jobMap.values());
    }
  }

  private async readDetailCache(key: string): Promise<MatchBriefDetail | null> {
    if (!this.redis || this.redisDisabled) return null;
    try {
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (err: any) {
      this.logger.warn(`Redis GET failed for Match Brief detail: ${err.message}`);
      return null;
    }
  }

  private async writeCache(entries: Map<string, MatchBriefSummary | MatchBriefDetail>) {
    if (!this.redis || this.redisDisabled || entries.size === 0) return;
    try {
      const pipeline = this.redis.pipeline();
      for (const [key, value] of entries.entries()) {
        pipeline.setex(key, CACHE_TTL_SECONDS, JSON.stringify(value));
      }
      await pipeline.exec();
    } catch (err: any) {
      this.logger.warn(`Redis cache write failed for Match Briefs: ${err.message}`);
    }
  }
}

