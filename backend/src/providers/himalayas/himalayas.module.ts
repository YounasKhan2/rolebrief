import { Module } from "@nestjs/common";
import { AppConfigModule } from "../../common/config/app-config.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { IngestionOrchestratorService } from "../ingestion-orchestrator.service";
import { JobPersistenceService } from "../job-persistence.service";
import { HimalayasAdapter } from "./himalayas.adapter";
import { HimalayasIngestionService } from "./himalayas.ingestion.service";

@Module({
  imports: [AppConfigModule, PrismaModule],
  providers: [HimalayasAdapter, HimalayasIngestionService, IngestionOrchestratorService, JobPersistenceService],
  exports: [HimalayasAdapter, HimalayasIngestionService, IngestionOrchestratorService, JobPersistenceService]
})
export class HimalayasModule {}
