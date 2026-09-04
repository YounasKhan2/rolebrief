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
}
