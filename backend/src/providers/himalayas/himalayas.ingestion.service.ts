import { Injectable } from "@nestjs/common";
import { IngestionOptions, IngestionOrchestratorService } from "../ingestion-orchestrator.service";
import { IngestionMode } from "../provider-adapter";
import { HimalayasAdapter } from "./himalayas.adapter";

type LegacyMode = "initial-backfill" | "recurring-sync" | "live-smoke";
type HimalayasIngestionOptions = Omit<IngestionOptions, "mode"> & { mode?: IngestionMode | LegacyMode };

@Injectable()
export class HimalayasIngestionService {
  constructor(
    private readonly adapter: HimalayasAdapter,
    private readonly orchestrator: IngestionOrchestratorService
  ) {}

  ingest(options: HimalayasIngestionOptions = {}) {
    const mode = normalizeMode(options.mode);
    return this.orchestrator.ingest(this.adapter, {
      ...options,
      mode,
      persist: options.persist ?? mode !== "smoke"
    });
  }
}

function normalizeMode(mode: IngestionMode | LegacyMode | undefined): IngestionMode {
  if (mode === "initial-backfill") return "backfill";
  if (mode === "recurring-sync") return "incremental";
  if (mode === "live-smoke") return "smoke";
  return mode ?? "incremental";
}
