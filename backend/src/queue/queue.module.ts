import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AppConfigModule } from "../common/config/app-config.module";
import { AppConfigService } from "../common/config/app-config.service";
import { QUEUES } from "./queue.constants";
import { RedisProbeService } from "./redis-probe.service";

@Module({
  imports: [
    AppConfigModule,
    BullModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        connection: { url: config.redisUrl },
        prefix: config.queuePrefix
      })
    }),
    BullModule.registerQueue(
      { name: QUEUES.ingestion },
      { name: QUEUES.verification },
      { name: QUEUES.enrichment },
      { name: QUEUES.alerts },
      { name: QUEUES.delivery }
    )
  ],
  providers: [RedisProbeService],
  exports: [BullModule]
})
export class QueueModule {}
