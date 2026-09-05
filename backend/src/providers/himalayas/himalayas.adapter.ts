import { Injectable } from "@nestjs/common";
import { AppConfigService } from "../../common/config/app-config.service";
import { IngestionMode, JobProviderAdapter, ProviderCapabilities, ProviderFailure, ProviderPage, ProviderPageRequest, ValidationResult } from "../provider-adapter";
import { HimalayasJobDto, himalayasJobSchema, himalayasResponseSchema } from "./himalayas.dto";
import { normalizeHimalayasJob } from "./himalayas.normalizer";

@Injectable()
export class HimalayasAdapter implements JobProviderAdapter<HimalayasJobDto> {
  readonly key = "himalayas.guid";
  readonly providerId = this.key;
  readonly capabilities: ProviderCapabilities = {
    pagination: "cursor",
    maxPageSize: 20,
    hasExpiry: true,
    hasApplicationDeadline: false,
    hasSalary: true,
    hasCountryRestrictions: true,
    hasTimezoneRestrictions: true,
    descriptionFormat: "html",
    search: "filter",
    refreshInterval: "24h",
    attribution: "Display visible Himalayas attribution and link to the original job."
  };

  constructor(private readonly config: AppConfigService) {}

  isEnabled() {
    return this.config.himalayas.enabled;
  }

  pageLimitFor(mode: IngestionMode) {
    const settings = this.config.himalayas;
    if (mode === "smoke") return 1;
    if (mode === "backfill") return settings.initialBackfillPages ?? 25;
    return settings.recurringSyncPages ?? 10;
  }

  requestDelayMs() {
    return this.config.himalayas.requestDelayMs;
  }

  unchangedStopThreshold() {
    return this.config.himalayas.unchangedStopThreshold;
  }

  validateRecord(input: unknown): ValidationResult<HimalayasJobDto> {
    const result = himalayasJobSchema.safeParse(input);
    if (result.success) return { ok: true, record: result.data };
    return { ok: false, error: result.error.issues.map((issue) => issue.path.join(".") || issue.message).slice(0, 5).join("; ") };
  }

  normalize(record: HimalayasJobDto) {
    return normalizeHimalayasJob(record);
  }

  getExternalIdentity(record: HimalayasJobDto) {
    return record.guid;
  }

  async fetchPage(request: ProviderPageRequest): Promise<ProviderPage<unknown>> {
    const settings = this.config.himalayas;
    const failures: ProviderFailure[] = [];
    const cursor = request.cursor;

    const retryAttempts = settings.retryAttempts ?? 3;
    for (let attempt = 0; attempt <= retryAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), settings.timeoutMs);

      try {
        const url = new URL(settings.apiUrl);
        url.searchParams.set("limit", String(Math.min(request.limit, this.capabilities.maxPageSize)));
        if (cursor) {
          url.searchParams.set("cursor", cursor);
        }

        const response = await fetch(url, { signal: request.signal ?? controller.signal });
        if (response.status === 429) {
          failures.push({ cursor, status: 429, message: "Himalayas rate limit exceeded", retryable: true });
          await this.delay(this.retryDelayFrom(response) ?? settings.rateLimitDelayMs);
          continue;
        }

        if (!response.ok) {
          failures.push({
            cursor,
            status: response.status,
            message: `Himalayas request failed with ${response.status}`,
            retryable: response.status >= 500
          });
          if (response.status < 500) break;
          await this.delay(settings.retryDelayMs);
          continue;
        }

        const parsed = himalayasResponseSchema.parse(await response.json());
        return {
          records: parsed.jobs,
          nextCursor: parsed.nextCursor ?? null,
          fetchedAt: new Date(),
          partialFailures: failures,
          terminal: !parsed.nextCursor
        };
      } catch (error) {
        failures.push({
          cursor,
          message: error instanceof Error ? error.message : "Himalayas request failed",
          retryable: true
        });
        if (attempt < retryAttempts) {
          await this.delay(settings.retryDelayMs);
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    return { records: [], nextCursor: null, fetchedAt: new Date(), partialFailures: failures, terminal: true };
  }

  protected delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private retryDelayFrom(response: Response) {
    const retryAfter = response.headers.get("retry-after");
    if (!retryAfter) return null;
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(seconds, 0) * 1000;
    const date = new Date(retryAfter);
    return Number.isNaN(date.getTime()) ? null : Math.max(date.getTime() - Date.now(), 0);
  }
}
