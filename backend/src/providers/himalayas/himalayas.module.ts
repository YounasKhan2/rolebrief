import { Module } from "@nestjs/common";
import { AppConfigModule } from "../../common/config/app-config.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { HimalayasAdapter } from "./himalayas.adapter";
import { HimalayasIngestionService } from "./himalayas.ingestion.service";

@Module({
  imports: [AppConfigModule, PrismaModule],
  providers: [HimalayasAdapter, HimalayasIngestionService],
  exports: [HimalayasAdapter, HimalayasIngestionService]
})
export class HimalayasModule {}
