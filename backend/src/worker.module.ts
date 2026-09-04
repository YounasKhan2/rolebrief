import { Module } from "@nestjs/common";
import { AppConfigModule } from "./common/config/app-config.module";
import { LoggingModule } from "./common/logging/logging.module";
import { PrismaModule } from "./prisma/prisma.module";
import { QueueModule } from "./queue/queue.module";
import { IngestionModule } from "./ingestion/ingestion.module";
import { ProvidersModule } from "./providers/providers.module";

@Module({
  imports: [AppConfigModule, LoggingModule, PrismaModule, QueueModule, ProvidersModule, IngestionModule]
})
export class WorkerModule {}
