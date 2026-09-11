import { HttpException, HttpStatus, Injectable, OnModuleDestroy, ServiceUnavailableException } from "@nestjs/common";
import { createHash } from "node:crypto";
import Redis from "ioredis";
import { AppConfigService } from "../../common/config/app-config.service";

@Injectable()
export class ResumeRateLimitService implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(private readonly config: AppConfigService) {
    this.redis = new Redis(config.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      enableOfflineQueue: false,
      connectTimeout: 1000,
      retryStrategy: () => null
    });
    this.redis.on("error", () => undefined);
  }

  async onModuleDestroy() {
    await this.redis.quit().catch(() => undefined);
  }

  async consume(options: { namespace: string; subject: string; limit: number; windowSeconds: number }) {
    const key = `rl:resumes:${options.namespace}:${createHash("sha256").update(options.subject).digest("hex")}`;
    try {
      if (this.redis.status === "wait" || this.redis.status === "end") {
        await this.withTimeout(this.redis.connect());
      }
      const count = (await this.withTimeout(this.redis.eval(
          `
            local current = redis.call('INCR', KEYS[1])
            if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
            return current
          `,
          1,
          key,
          options.windowSeconds
        ))) as number;
      if (count > options.limit) {
        const ttl = Math.max(await this.redis.ttl(key), 1);
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            error: "Too Many Requests",
            message: "Too many resume upload requests. Please wait before trying again.",
            retryAfterSeconds: ttl
          },
          HttpStatus.TOO_MANY_REQUESTS
        );
      }
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new ServiceUnavailableException({
        message: "Resume upload admission control is temporarily unavailable.",
        retryAfterSeconds: 30
      });
    }
  }

  private withTimeout<T>(operation: Promise<T>) {
    return Promise.race([
      operation,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Redis rate limiter timed out.")), 1500))
    ]);
  }
}
