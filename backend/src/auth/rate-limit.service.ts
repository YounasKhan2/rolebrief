import { HttpException, HttpStatus, Injectable, OnModuleDestroy } from "@nestjs/common";
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

  async consume(scope: string, key: string, limit: number, windowSeconds = 900) {
    const redisKey = `auth:rate:${scope}:${key}`;
    const count = await this.redis.incr(redisKey);
    if (count === 1) {
      await this.redis.expire(redisKey, windowSeconds);
    }
    if (count > limit) {
      throw new HttpException("Too many attempts. Try again later.", HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}
