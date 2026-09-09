import { Injectable, Logger, NotFoundException, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";
import * as crypto from "node:crypto";
import { AppConfigService } from "../../common/config/app-config.service";
import { PrismaService } from "../../prisma/prisma.service";
import { EligibilityEvaluatorService } from "./eligibility-evaluator.service";
import { CandidateEligibilityFacts, CanonicalRemoteScope, JobEligibilityFacts } from "./factual-facts.interface";
import { DetailedEligibilityResult, EligibilitySummary } from "./reason-codes";

export const CACHE_TTL_SECONDS = 3600;
export const ELIGIBILITY_ENGINE_VERSION = "v1";

export function computeJobEligibilityVersion(jobFacts: JobEligibilityFacts): string {
  const hashPayload = JSON.stringify({
    workMode: jobFacts.workMode,
    remoteScope: jobFacts.remoteScope,
    remoteCountryCodes: [...jobFacts.remoteCountryCodes].sort(),
    remoteRestrictionLabels: [...jobFacts.remoteRestrictionLabels].sort(),
    unresolvedLabels: [...jobFacts.unresolvedLabels].sort(),
    timezoneOffsetMinutes: [...jobFacts.timezoneOffsetMinutes].sort((a, b) => a - b),
    jobStatus: jobFacts.jobStatus,
    applicationDeadlineAt: jobFacts.applicationDeadlineAt ? jobFacts.applicationDeadlineAt.toISOString() : null,
    hasApplicationUrl: Boolean(jobFacts.applicationUrl)
  });
  return crypto.createHash("sha256").update(hashPayload).digest("hex").slice(0, 16);
}

@Injectable()
export class EligibilityService implements OnModuleDestroy {
  private readonly logger = new Logger(EligibilityService.name);
  private readonly redis: Redis | null;
  private isRedisDisabled = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly evaluator: EligibilityEvaluatorService
  ) {
    try {
      this.redis = new Redis(config.redisUrl, {
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
        lazyConnect: true
      });
      this.redis.on("error", (err) => {
        if (!this.isRedisDisabled) {
          this.logger.warn(`Redis connection error in EligibilityService, operating in fail-open mode: ${err.message}`);
          this.isRedisDisabled = true;
        }
      });
    } catch (err: any) {
      this.redis = null;
      this.isRedisDisabled = true;
      this.logger.warn(`Failed to initialize Redis in EligibilityService: ${err.message}`);
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit().catch(() => undefined);
    }
  }

  /**
   * Retrieves factual candidate facts strictly from CandidateProfile and User.timezone.
   */
  async getCandidateFacts(userId: string): Promise<CandidateEligibilityFacts> {
    const [profile, user] = await Promise.all([
      this.prisma.candidateProfile.findUnique({
        where: { userId },
        select: {
          currentCountry: true,
          workAuthorizations: true,
          requiresVisaSponsorship: true,
          revision: true
        }
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { timezone: true }
      })
    ]);

    return {
      userId,
      currentCountry: profile?.currentCountry ?? null,
      workAuthorizations: profile?.workAuthorizations ?? [],
      requiresVisaSponsorship: profile?.requiresVisaSponsorship ?? null,
      timezone: user?.timezone ?? null,
      revision: profile?.revision ?? 0
    };
  }

  /**
   * Converts a database Job record into JobEligibilityFacts.
   */
  toJobFacts(job: any): JobEligibilityFacts {
    const remoteJson = (job.remoteRestrictions as Record<string, any>) ?? {};
    const unresolvedLabels: string[] = Array.isArray(remoteJson.unresolvedLabels)
      ? remoteJson.unresolvedLabels
      : [];
    const timezoneOffsetMinutes: number[] = Array.isArray(remoteJson.timezoneOffsetMinutes)
      ? remoteJson.timezoneOffsetMinutes
      : [];

    return {
      id: job.id,
      slug: job.slug,
      title: job.canonicalTitle,
      companyName: job.company?.canonicalName ?? "",
      workMode: job.workMode,
      remoteScope: (job.remoteScope as CanonicalRemoteScope) || "UNKNOWN",
      remoteCountryCodes: job.remoteCountryCodes ?? [],
      remoteRestrictionLabels: job.remoteRestrictionLabels ?? [],
      unresolvedLabels,
      timezoneOffsetMinutes,
      jobStatus: job.status,
      flags: job.flags ?? [],
      applicationDeadlineAt: job.applicationDeadlineAt,
      applicationUrl: job.sourceDisclosure?.applicationUrl ?? null,
      canonicalFingerprint: job.canonicalFingerprint ?? job.slug
    };
  }

  /**
   * Evaluates batch of job slugs with Redis MGET pipeline and fail-open resilience.
   */
  async evaluateBatch(userId: string, slugs: string[]): Promise<EligibilitySummary[]> {
    if (slugs.length === 0) return [];

    const uniqueSlugs = Array.from(new Set(slugs));
    const candidateFacts = await this.getCandidateFacts(userId);

    // 1. Fetch jobs from DB
    const jobs = await this.prisma.job.findMany({
      where: { slug: { in: uniqueSlugs } },
      include: { company: true }
    });

    const jobFactsMap = new Map<string, JobEligibilityFacts>();
    for (const j of jobs) {
      jobFactsMap.set(j.slug, this.toJobFacts(j));
    }

    // 2. Formulate cache keys: eligibility:{engineVersion}:{userId}:{profileRevision}:{jobId}:{jobEligibilityVersion}
    const slugToCacheKey = new Map<string, string>();
    for (const [slug, jobFacts] of jobFactsMap.entries()) {
      const jobEligibilityVersion = computeJobEligibilityVersion(jobFacts);
      slugToCacheKey.set(
        slug,
        `eligibility:${ELIGIBILITY_ENGINE_VERSION}:${userId}:${candidateFacts.revision}:${jobFacts.id}:${jobEligibilityVersion}`
      );
    }

    const summariesMap = new Map<string, EligibilitySummary>();
    const misses: JobEligibilityFacts[] = [];

    // 3. Try reading from Redis if available
    if (this.redis && !this.isRedisDisabled) {
      try {
        const cacheKeys = Array.from(slugToCacheKey.values());
        if (cacheKeys.length > 0) {
          const cachedValues = await this.redis.mget(cacheKeys);
          let keyIndex = 0;
          for (const [slug, _key] of slugToCacheKey.entries()) {
            const cached = cachedValues[keyIndex++];
            if (cached) {
              try {
                summariesMap.set(slug, JSON.parse(cached));
              } catch {
                const facts = jobFactsMap.get(slug);
                if (facts) misses.push(facts);
              }
            } else {
              const facts = jobFactsMap.get(slug);
              if (facts) misses.push(facts);
            }
          }
        }
      } catch (err: any) {
        this.logger.warn(`Redis MGET failed, continuing without cache: ${err.message}`);
        for (const facts of jobFactsMap.values()) {
          if (!summariesMap.has(facts.slug)) {
            misses.push(facts);
          }
        }
      }
    } else {
      for (const facts of jobFactsMap.values()) {
        misses.push(facts);
      }
    }

    // 4. Compute evaluations for cache misses
    const newCacheEntries: Record<string, string> = {};
    for (const facts of misses) {
      const detailed = this.evaluator.evaluate(candidateFacts, facts);
      const summary = this.evaluator.summarize(detailed);
      summariesMap.set(facts.slug, summary);

      const cacheKey = slugToCacheKey.get(facts.slug);
      if (cacheKey) {
        newCacheEntries[cacheKey] = JSON.stringify(summary);
      }
    }

    // 5. Store newly computed entries in Redis pipeline
    if (this.redis && !this.isRedisDisabled && Object.keys(newCacheEntries).length > 0) {
      try {
        const pipeline = this.redis.pipeline();
        for (const [key, value] of Object.entries(newCacheEntries)) {
          pipeline.setex(key, CACHE_TTL_SECONDS, value);
        }
        await pipeline.exec();
      } catch (err: any) {
        this.logger.warn(`Redis pipeline cache set failed: ${err.message}`);
      }
    }

    // 6. Return summaries in the same order as input slugs
    const results: EligibilitySummary[] = [];
    for (const slug of slugs) {
      const summary = summariesMap.get(slug);
      if (summary) {
        results.push(summary);
      }
    }

    return results;
  }

  /**
   * Evaluates single job and returns complete detailed explanation.
   */
  async evaluateJob(userId: string, slug: string): Promise<DetailedEligibilityResult> {
    const candidateFacts = await this.getCandidateFacts(userId);

    const job = await this.prisma.job.findUnique({
      where: { slug },
      include: { company: true }
    });

    if (!job) {
      throw new NotFoundException(`Job "${slug}" not found`);
    }

    const jobFacts = this.toJobFacts(job);
    const jobEligibilityVersion = computeJobEligibilityVersion(jobFacts);
    const cacheKey = `eligibility:${ELIGIBILITY_ENGINE_VERSION}:detail:${userId}:${candidateFacts.revision}:${jobFacts.id}:${jobEligibilityVersion}`;

    // Try reading detailed result from Redis
    if (this.redis && !this.isRedisDisabled) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (err: any) {
        this.logger.warn(`Redis GET failed for job detail: ${err.message}`);
      }
    }

    // Evaluate
    const result = this.evaluator.evaluate(candidateFacts, jobFacts);

    // Write to Redis
    if (this.redis && !this.isRedisDisabled) {
      try {
        await this.redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(result));
      } catch (err: any) {
        this.logger.warn(`Redis SETEX failed for job detail: ${err.message}`);
      }
    }

    return result;
  }
}
