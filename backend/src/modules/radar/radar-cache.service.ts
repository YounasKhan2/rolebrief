import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";
import { randomUUID } from "node:crypto";
import { AppConfigService } from "../../common/config/app-config.service";
import { RadarSnapshot, RADAR_SNAPSHOT_TTL_SECONDS } from "./radar.types";

@Injectable()
export class RadarCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(RadarCacheService.name);
  private readonly redis: Redis | null;
  private disabled = false;

  constructor(private readonly config: AppConfigService) {
    try {
      this.redis = new Redis(config.redisUrl, {
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
        lazyConnect: true
      });
      this.redis.on("error", (err) => {
        if (!this.disabled) {
          this.logger.warn(`Redis connection error in RadarCacheService, pagination snapshots may expire early: ${err.message}`);
          this.disabled = true;
        }
      });
    } catch (err: any) {
      this.redis = null;
      this.disabled = true;
      this.logger.warn(`Failed to initialize Redis in RadarCacheService: ${err.message}`);
    }
  }

  createSnapshotId() {
    return randomUUID();
  }

  async get(feedSnapshotId: string): Promise<RadarSnapshot | null> {
    if (!this.redis || this.disabled) return null;
    try {
      const cached = await this.redis.get(this.key(feedSnapshotId));
      return cached ? (JSON.parse(cached) as RadarSnapshot) : null;
    } catch (err: any) {
      this.logger.warn(`Radar snapshot read failed: ${err.message}`);
      return null;
    }
  }

  async set(snapshot: RadarSnapshot): Promise<boolean> {
    if (!this.redis || this.disabled) return false;
    try {
      await this.redis.setex(this.key(snapshot.feedSnapshotId), RADAR_SNAPSHOT_TTL_SECONDS, JSON.stringify(snapshot));
      return true;
    } catch (err: any) {
      this.logger.warn(`Radar snapshot write failed: ${err.message}`);
      return false;
    }
  }

  async onModuleDestroy() {
    this.redis?.disconnect();
  }

  private key(feedSnapshotId: string) {
    return `radar:snapshot:${feedSnapshotId}`;
  }
}
