import { Controller, Get } from "@nestjs/common";
import {
  HealthCheck,
  HealthCheckError,
  HealthCheckService,
  HealthIndicatorService,
  PrismaHealthIndicator
} from "@nestjs/terminus";
import Redis from "ioredis";
import { AppConfigService } from "../common/config/app-config.service";
import { PrismaService } from "../prisma/prisma.service";
import { Public } from "../auth/auth.decorators";

@Controller("health")
@Public()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly indicator: HealthIndicatorService,
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService
  ) {}

  @Get("live")
  live() {
    return { status: "ok" };
  }

  @Get("ready")
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.prismaHealth.pingCheck("postgres", this.prisma),
      async () => {
        const redis = new Redis(this.config.redisUrl, {
          connectTimeout: 1000,
          enableOfflineQueue: false,
          lazyConnect: true,
          maxRetriesPerRequest: 0,
          retryStrategy: null
        });

        try {
          redis.on("error", () => undefined);
          await redis.connect();
          await redis.ping();
          return this.indicator.check("redis").up();
        } catch (error) {
          const result = this.indicator.check("redis").down({
            message: error instanceof Error ? error.message : "Redis ping failed"
          });
          throw new HealthCheckError("Redis health check failed", result);
        } finally {
          redis.disconnect();
        }
      }
    ]);
  }
}
