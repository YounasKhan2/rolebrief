import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { JobPersistenceService, PersistOutcome } from "./job-persistence.service";
import { IngestionMode, JobProviderAdapter, ProviderKey } from "./provider-adapter";

export interface IngestionOptions {
  mode?: IngestionMode;
  pageLimit?: number;
  persist?: boolean;
  restart?: boolean;
}

@Injectable()
export class IngestionOrchestratorService {
  private readonly logger = new Logger(IngestionOrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly persistence: JobPersistenceService
  ) {}

  async ingest<TRecord>(adapter: JobProviderAdapter<TRecord>, options: IngestionOptions = {}) {
    if (!adapter.isEnabled()) {
      return { skipped: true, reason: `${adapter.key} provider disabled`, fetched: 0, accepted: 0, rejected: 0 };
    }

    const mode = options.mode ?? "incremental";
    const persist = options.persist ?? mode !== "smoke";
    const pageLimit = options.pageLimit ?? adapter.pageLimitFor(mode);
    const checkpointMode = mode === "backfill" ? "backfill" : "incremental";
    const checkpoint = options.restart
      ? null
      : await this.prisma.ingestionCheckpoint.findUnique({ where: { providerId_mode: { providerId: adapter.key, mode: checkpointMode } } });
    let cursor = mode === "backfill" ? checkpoint?.cursor ?? null : null;

    const run = await this.prisma.ingestionRun.create({
      data: {
        providerId: adapter.key,
        partition: `jobs:${mode}`,
        mode,
        status: "running",
        startingCheckpoint: cursor,
        pagesRequested: pageLimit
      }
    });

    let pagesFetched = 0;
    let pagesCompleted = 0;
    let fetched = 0;
    let accepted = 0;
    let rejected = 0;
    let created = 0;
    let updated = 0;
    let unchanged = 0;
    let expired = 0;
    let retryCount = 0;
    let consecutiveUnchanged = 0;
    let stopReason = "page_limit";
    let watermarkExternalId: string | null = null;
    let watermarkContentHash: string | null = null;
    const failures: Prisma.InputJsonValue[] = [];
    const rejections: Prisma.InputJsonValue[] = [];

    try {
      for (let page = 0; page < pageLimit; page += 1) {
        const requestLimit = mode === "smoke" ? 1 : adapter.capabilities.maxPageSize;
        const providerPage = await adapter.fetchPage({ cursor, limit: requestLimit, mode });
        pagesFetched += 1;
        retryCount += providerPage.partialFailures.filter((failure) => failure.retryable).length;
        failures.push(...providerPage.partialFailures.map((failure) => sanitizeFailure(failure)));

        if (providerPage.records.length === 0 && providerPage.partialFailures.length > 0) {
          stopReason = "provider_error";
          break;
        }

        for (const input of providerPage.records) {
          fetched += 1;
          const validation = adapter.validateRecord(input);
          if (!validation.ok || !validation.record) {
            rejected += 1;
            rejections.push({ reason: validation.error ?? "validation_failed" });
            continue;
          }

          try {
            const normalized = adapter.normalize(validation.record);
            watermarkExternalId ??= adapter.getExternalIdentity(validation.record);
            watermarkContentHash ??= normalized.contentHash;
            const outcome: PersistOutcome = persist ? await this.persistence.persist(adapter.key, normalized) : "unchanged";
            accepted += 1;
            if (outcome === "created") {
              created += 1;
              consecutiveUnchanged = 0;
            } else if (outcome === "updated") {
              updated += 1;
              consecutiveUnchanged = 0;
            } else if (outcome === "expired") {
              expired += 1;
              consecutiveUnchanged = 0;
            } else {
              unchanged += 1;
              consecutiveUnchanged += 1;
            }
          } catch (error) {
            rejected += 1;
            const message = sanitizeError(error);
            rejections.push({ reason: message });
            this.logger.warn(message);
          }
        }

        pagesCompleted += 1;
        cursor = providerPage.nextCursor;
        await this.persistCheckpoint(adapter.key, checkpointMode, cursor, watermarkExternalId, watermarkContentHash, {
          mode,
          persist,
          runId: run.id,
          pagesCompleted
        });

        if (providerPage.terminal || !cursor) {
          stopReason = "terminal_cursor";
          break;
        }
        if (mode === "incremental" && consecutiveUnchanged >= adapter.unchangedStopThreshold()) {
          stopReason = "unchanged_threshold";
          break;
        }
        await delay(adapter.requestDelayMs());
      }

      await this.prisma.ingestionRun.update({
        where: { id: run.id },
        data: {
          status: failures.length > 0 || rejections.length > 0 ? "partial" : "succeeded",
          pagesFetched,
          pagesCompleted,
          recordsFetched: fetched,
          recordsAccepted: accepted,
          recordsRejected: rejected,
          recordsCreated: created,
          recordsUpdated: updated,
          recordsUnchanged: unchanged,
          recordsExpired: expired,
          retryCount,
          terminalCursor: cursor,
          terminalCheckpoint: cursor,
          stopReason,
          finishedAt: new Date(),
          metadata: { mode, pageLimit, persist, failures, rejections } as Prisma.InputJsonObject
        }
      });

      return {
        skipped: false,
        mode,
        persist,
        pagesFetched,
        pagesCompleted,
        fetched,
        accepted,
        rejected,
        created,
        updated,
        unchanged,
        expired,
        retryCount,
        terminalCursor: cursor,
        stopReason,
        failures,
        rejections
      };
    } catch (error) {
      await this.prisma.ingestionRun.update({
        where: { id: run.id },
        data: {
          status: "failed",
          pagesFetched,
          pagesCompleted,
          recordsFetched: fetched,
          recordsAccepted: accepted,
          recordsRejected: rejected,
          recordsCreated: created,
          recordsUpdated: updated,
          recordsUnchanged: unchanged,
          recordsExpired: expired,
          retryCount,
          terminalCursor: cursor,
          terminalCheckpoint: cursor,
          stopReason: "exception",
          finishedAt: new Date(),
          metadata: { mode, pageLimit, persist, failures, rejections, error: sanitizeError(error) } as Prisma.InputJsonObject
        }
      });
      throw error;
    }
  }

  private persistCheckpoint(
    providerId: ProviderKey,
    mode: string,
    cursor: string | null,
    watermarkExternalId: string | null,
    watermarkContentHash: string | null,
    metadata: Prisma.InputJsonObject
  ) {
    return this.prisma.ingestionCheckpoint.upsert({
      where: { providerId_mode: { providerId, mode } },
      create: { providerId, mode, cursor, watermarkExternalId, watermarkContentHash, metadata },
      update: { cursor, watermarkExternalId, watermarkContentHash, metadata }
    });
  }
}

function sanitizeFailure(failure: { cursor: string | null; status?: number; message: string; retryable: boolean }) {
  return {
    cursor: failure.cursor,
    status: failure.status,
    retryable: failure.retryable,
    message: failure.message.slice(0, 300)
  } as Prisma.InputJsonObject;
}

function sanitizeError(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 500) : "unknown";
}

function delay(ms: number) {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}
