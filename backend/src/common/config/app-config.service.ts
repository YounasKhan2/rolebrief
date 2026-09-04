import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Env } from "./env.schema";

@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get nodeEnv() {
    return this.config.get("NODE_ENV", { infer: true });
  }

  get port() {
    return this.config.get("PORT", { infer: true });
  }

  get logLevel() {
    return this.config.get("LOG_LEVEL", { infer: true });
  }

  get databaseUrl() {
    return this.config.get("DATABASE_URL", { infer: true });
  }

  get redisUrl() {
    return this.config.get("REDIS_URL", { infer: true });
  }

  get queuePrefix() {
    return this.config.get("QUEUE_PREFIX", { infer: true });
  }

  get workerConcurrency() {
    return this.config.get("WORKER_CONCURRENCY", { infer: true });
  }

  get himalayas() {
    return {
      enabled: this.config.get("HIMALAYAS_ENABLED", { infer: true }),
      apiUrl: this.config.get("HIMALAYAS_API_URL", { infer: true }),
      timeoutMs: this.config.get("HIMALAYAS_TIMEOUT_MS", { infer: true }),
      pageLimit: this.config.get("HIMALAYAS_PAGE_LIMIT", { infer: true }),
      maxPagesPerRun: this.config.get("HIMALAYAS_MAX_PAGES_PER_RUN", { infer: true }),
      retryAttempts: this.config.get("HIMALAYAS_RETRY_ATTEMPTS", { infer: true }),
      retryDelayMs: this.config.get("HIMALAYAS_RETRY_DELAY_MS", { infer: true }),
      rateLimitDelayMs: this.config.get("HIMALAYAS_RATE_LIMIT_DELAY_MS", { infer: true }),
      cron: this.config.get("HIMALAYAS_CRON", { infer: true }),
      liveSmoke: this.config.get("HIMALAYAS_LIVE_SMOKE", { infer: true })
    };
  }
}
