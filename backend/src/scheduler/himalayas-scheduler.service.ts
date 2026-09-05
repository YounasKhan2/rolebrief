import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { Queue } from "bullmq";
import { AppConfigService } from "../common/config/app-config.service";
import { INGEST_HIMALAYAS_JOB, QUEUES } from "../queue/queue.constants";

@Injectable()
export class HimalayasSchedulerService {
  private readonly logger = new Logger(HimalayasSchedulerService.name);

  constructor(
    private readonly config: AppConfigService,
    @InjectQueue(QUEUES.ingestion) private readonly ingestionQueue: Queue
  ) {}

  async syncSchedule() {
    const settings = this.config.himalayas;
    if (!settings.enabled) {
      this.logger.log("Himalayas provider disabled; no ingestion job scheduled");
      return;
    }

    await this.ingestionQueue.upsertJobScheduler(
      INGEST_HIMALAYAS_JOB,
      { pattern: settings.cron },
      {
        name: INGEST_HIMALAYAS_JOB,
        data: { providerId: "himalayas.guid", mode: "recurring-sync" },
        opts: { removeOnComplete: 25, removeOnFail: 50 }
      }
    );
  }
}
