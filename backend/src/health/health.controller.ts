import { Controller, Get } from "@nestjs/common";
import {
  HealthCheck,
  HealthCheckError,
  HealthCheckService,
  HealthIndicatorService,
  PrismaHealthIndicator
} from "@nestjs/terminus";
import Redis from "ioredis";
import { Socket } from "node:net";
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

        let connected = false;
        try {
          redis.on("error", () => undefined);
          await redis.connect();
          connected = true;
          await redis.ping();
          return this.indicator.check("redis").up();
        } catch (error) {
          const result = this.indicator.check("redis").down({
            message: error instanceof Error ? error.message : "Redis ping failed"
          });
          throw new HealthCheckError("Redis health check failed", result);
        } finally {
          if (connected) {
            redis.disconnect();
          }
        }
      }
    ]);
  }

  @Get("resume-processing")
  async resumeProcessing() {
    const clamav = await this.checkTcp(this.config.resumes.scanning.host, this.config.resumes.scanning.port, 1000);
    return {
      status: clamav ? "ok" : "degraded",
      details: {
        clamav: { status: clamav ? "up" : "down" },
        verificationQueue: { status: "configured" },
        storage: { status: "configured" }
      }
    };
  }

  private checkTcp(host: string, port: number, timeoutMs: number) {
    return new Promise<boolean>((resolve) => {
      const socket = new Socket();
      const done = (value: boolean) => {
        socket.destroy();
        resolve(value);
      };
      socket.setTimeout(timeoutMs);
      socket.once("connect", () => done(true));
      socket.once("timeout", () => done(false));
      socket.once("error", () => done(false));
      socket.connect(port, host);
    });
  }
}
