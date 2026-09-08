import { HttpException, HttpStatus, Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { createHash } from "node:crypto";
import Redis from "ioredis";
import { AppConfigService } from "../config/app-config.service";

export interface ConsumeOptions {
  namespace: string;
  subject: string;
  limit: number;
  windowSeconds: number;
}

export interface ConsumeResult {
  allowed: boolean;
  count: number;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

@Injectable()
export class RateLimitService implements OnModuleDestroy {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly redis: Redis;

  constructor(private readonly config: AppConfigService) {
    this.redis = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true
    });
  }

  async onModuleDestroy() {
    await this.redis.quit().catch(() => undefined);
  }

  private hashKey(subject: string): string {
    return createHash("sha256").update(subject.trim().toLowerCase()).digest("hex");
  }

  async consume(options: ConsumeOptions): Promise<ConsumeResult> {
    const { namespace, subject, limit, windowSeconds } = options;
    const hashed = this.hashKey(subject);
    const redisKey = `rl:${namespace}:${hashed}`;

    try {
      // Atomic increment and TTL set via Lua script
      const script = `
        local current = redis.call('INCR', KEYS[1])
        if current == 1 then
          redis.call('EXPIRE', KEYS[1], ARGV[1])
        end
        return current
      `;
      const count = (await this.redis.eval(script, 1, redisKey, windowSeconds)) as number;

      if (count > limit) {
        const ttl = await this.redis.ttl(redisKey);
        const retryAfterSeconds = Math.max(ttl, 1);
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            error: "Too Many Requests",
            message: "Too many requests. Please wait before trying again.",
            retryAfterSeconds
          },
          HttpStatus.TOO_MANY_REQUESTS
        );
      }

      return {
        allowed: true,
        count,
        limit,
        remaining: Math.max(0, limit - count),
        retryAfterSeconds: 0
      };
    } catch (err: any) {
      if (err instanceof HttpException) {
        throw err;
      }

      this.logger.error({
        event: "rate_limit.redis_failure",
        namespace,
        error: err instanceof Error ? err.message : String(err)
      });

      // Outage policy: fail-closed if configured, else fail-open
      if (this.config.auth.rateLimitFailClosed) {
        throw new HttpException(
          {
            statusCode: HttpStatus.SERVICE_UNAVAILABLE,
            message: "Rate limit service temporarily unavailable. Please try again shortly."
          },
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }

      // Fail-open with warning
      return {
        allowed: true,
        count: 0,
        limit,
        remaining: limit,
        retryAfterSeconds: 0
      };
    }
  }
}
