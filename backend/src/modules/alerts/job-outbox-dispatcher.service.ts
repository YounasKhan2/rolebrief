import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { OutboxStatus } from "@prisma/client";
import { Queue } from "bullmq";
import { PrismaService } from "../../prisma/prisma.service";
import { EVALUATE_JOB_ALERTS_JOB, QUEUES } from "../../queue/queue.constants";

@Injectable()
export class JobOutboxDispatcherService {
  private readonly logger = new Logger(JobOutboxDispatcherService.name);
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.alerts) private readonly alertsQueue: Queue
  ) {}

  async dispatchPendingEvents(batchSize: number = 50): Promise<number> {
    if (this.isProcessing) {
      return 0;
    }
    this.isProcessing = true;

    try {
      return await this.prisma.$transaction(async (tx: any) => {
        // Query pending outbox events using FOR UPDATE SKIP LOCKED
        const pendingEvents = await tx.$queryRaw`
          SELECT id, "jobId"
          FROM "JobOutboxEvent"
          WHERE status = 'PENDING'::"OutboxStatus"
          ORDER BY "createdAt" ASC
          LIMIT ${batchSize}
          FOR UPDATE SKIP LOCKED
        ` as Array<{ id: string; jobId: string }>;

        if (pendingEvents.length === 0) {
          return 0;
        }

        const ids = pendingEvents.map((e: { id: string; jobId: string }) => e.id);
        const jobsToEnqueue = pendingEvents.map((event: { id: string; jobId: string }) => ({
          name: EVALUATE_JOB_ALERTS_JOB,
          data: {
            outboxEventId: event.id,
            jobId: event.jobId
          },
          opts: {
            jobId: `outbox:${event.id}`,
            removeOnComplete: 100,
            removeOnFail: 200
          }
        }));

        await this.alertsQueue.addBulk(jobsToEnqueue);

        await tx.jobOutboxEvent.updateMany({
          where: { id: { in: ids } },
          data: { status: OutboxStatus.PROCESSING }
        });

        this.logger.debug(`Dispatched ${ids.length} outbox events to alerts queue.`);
        return ids.length;
      });
    } catch (err: any) {
      this.logger.error(`Failed to dispatch pending outbox events: ${err.message}`, err.stack);
      return 0;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Reclaims JobOutboxEvent rows stuck in PROCESSING longer than thresholdMs (default 15 minutes).
   * Increments attempts on retryable events, or marks them FAILED if maxAttempts exceeded.
   */
  async reapStalledEvents(thresholdMs: number = 15 * 60 * 1000, maxAttempts: number = 5): Promise<{ reset: number; failed: number }> {
    const cutoff = new Date(Date.now() - thresholdMs);

    try {
      return await this.prisma.$transaction(async (tx: any) => {
        // Query stalled events using FOR UPDATE SKIP LOCKED so we do not fight concurrent workers
        const stalled = await tx.$queryRaw`
          SELECT id, attempts
          FROM "JobOutboxEvent"
          WHERE status = 'PROCESSING'::"OutboxStatus"
            AND "updatedAt" <= ${cutoff}
          ORDER BY "updatedAt" ASC
          LIMIT 100
          FOR UPDATE SKIP LOCKED
        ` as Array<{ id: string; attempts: number }>;

        if (stalled.length === 0) {
          return { reset: 0, failed: 0 };
        }

        const failedIds: string[] = [];
        const resetIds: string[] = [];

        for (const item of stalled) {
          if (item.attempts >= maxAttempts) {
            failedIds.push(item.id);
          } else {
            resetIds.push(item.id);
          }
        }

        if (failedIds.length > 0) {
          await tx.jobOutboxEvent.updateMany({
            where: { id: { in: failedIds } },
            data: {
              status: OutboxStatus.FAILED,
              lastError: `Outbox processing exceeded maximum attempts (${maxAttempts}). Marked FAILED by reaper.`
            }
          });
          this.logger.warn(`Marked ${failedIds.length} stalled outbox events as FAILED after ${maxAttempts} attempts.`);
        }

        if (resetIds.length > 0) {
          await tx.jobOutboxEvent.updateMany({
            where: { id: { in: resetIds } },
            data: {
              status: OutboxStatus.PENDING,
              attempts: { increment: 1 }
            }
          });
          this.logger.warn(`Reclaimed ${resetIds.length} stalled outbox events older than ${Math.round(thresholdMs / 60000)}m back to PENDING.`);
        }

        return { reset: resetIds.length, failed: failedIds.length };
      });
    } catch (err: any) {
      this.logger.error(`Error during stalled outbox event reaping: ${err.message}`, err.stack);
      return { reset: 0, failed: 0 };
    }
  }
}
