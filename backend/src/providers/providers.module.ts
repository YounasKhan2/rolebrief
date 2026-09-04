import { Module } from "@nestjs/common";
import { HimalayasModule } from "./himalayas/himalayas.module";

@Module({
  imports: [HimalayasModule],
  exports: [HimalayasModule]
})
export class ProvidersModule {}
