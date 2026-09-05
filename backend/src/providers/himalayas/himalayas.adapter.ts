import { Injectable } from "@nestjs/common";
import { AppConfigService } from "../../common/config/app-config.service";
import { ProviderAdapter, ProviderFailure, ProviderPage } from "../provider-adapter";
import { HimalayasJobDto, himalayasResponseSchema } from "./himalayas.dto";

@Injectable()
export class HimalayasAdapter implements ProviderAdapter<HimalayasJobDto> {
  readonly providerId = "himalayas.guid";

  constructor(private readonly config: AppConfigService) {}

  async fetchPage(cursor: string | null): Promise<ProviderPage<HimalayasJobDto>> {
    const settings = this.config.himalayas;
    const failures: ProviderFailure[] = [];

    for (let attempt = 0; attempt <= settings.retryAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), settings.timeoutMs);

      try {
        const url = new URL(settings.apiUrl);
        url.searchParams.set("limit", "20");
        if (cursor) {
          url.searchParams.set("cursor", cursor);
        }

        const response = await fetch(url, { signal: controller.signal });
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
        if (attempt < settings.retryAttempts) {
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
