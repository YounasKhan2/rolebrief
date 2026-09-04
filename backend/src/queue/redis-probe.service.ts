import { Injectable, OnModuleInit } from "@nestjs/common";
import Redis from "ioredis";
import { AppConfigService } from "../common/config/app-config.service";

@Injectable()
export class RedisProbeService implements OnModuleInit {
  constructor(private readonly config: AppConfigService) {}

  async onModuleInit() {
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
    } finally {
      redis.disconnect();
    }
  }
}
