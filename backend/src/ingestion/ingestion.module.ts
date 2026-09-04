import { Module } from "@nestjs/common";
import { ProvidersModule } from "../providers/providers.module";
import { HimalayasProcessor } from "./himalayas.processor";

@Module({
  imports: [ProvidersModule],
  providers: [HimalayasProcessor]
})
export class IngestionModule {}
