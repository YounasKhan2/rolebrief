import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Job } from "bullmq";
import { HimalayasIngestionService } from "../providers/himalayas/himalayas.ingestion.service";
import { INGEST_HIMALAYAS_JOB, QUEUES } from "../queue/queue.constants";

@Injectable()
@Processor(QUEUES.ingestion)
export class HimalayasProcessor extends WorkerHost {
  constructor(private readonly himalayas: HimalayasIngestionService) {
    super();
  }

  async process(job: Job) {
    if (job.name !== INGEST_HIMALAYAS_JOB) {
      return { skipped: true, reason: `Unsupported ingestion job ${job.name}` };
    }

    const data = job.data as { mode?: "initial-backfill" | "recurring-sync" | "live-smoke"; pageLimit?: number };
    return this.himalayas.ingest({ mode: data.mode, pageLimit: data.pageLimit });
  }
}
