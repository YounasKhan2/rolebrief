import { HttpException, HttpStatus, Injectable, OnModuleDestroy } from "@nestjs/common";
import { createHash } from "node:crypto";
import Redis from "ioredis";
import { AppConfigService } from "../common/config/app-config.service";

@Injectable()
export class AuthRateLimitService implements OnModuleDestroy {
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

  private hashKey(key: string): string {
    return createHash("sha256").update(key.trim().toLowerCase()).digest("hex");
  }

  async consume(scope: string, key: string, limit: number, windowSeconds = 900) {
    const hashed = this.hashKey(key);
    const redisKey = `auth:rate:${scope}:${hashed}`;
    const count = await this.redis.incr(redisKey);
    if (count === 1) {
      await this.redis.expire(redisKey, windowSeconds);
    }
    if (count > limit) {
      const ttl = await this.redis.ttl(redisKey);
      const retryAfterSeconds = Math.max(ttl, 1);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: "Too many attempts. Please wait before trying again.",
          retryAfterSeconds
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
  }
}
