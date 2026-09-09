import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { WorkerModule } from "./worker.module";
import { JobOutboxDispatcherService } from "./modules/alerts/job-outbox-dispatcher.service";

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true
  });
  app.useLogger(app.get(Logger));

  const logger = app.get(Logger);
  const outboxDispatcher = app.get(JobOutboxDispatcherService);

  let isRunning = true;
  const pollIntervalMs = 2000;
  let lastReapAt = 0;
  const REAP_INTERVAL_MS = 60_000; // Check for stalled events every 60 seconds

  const pollLoop = async () => {
    while (isRunning) {
      try {
        await outboxDispatcher.dispatchPendingEvents(50);
      } catch (err: any) {
        logger.error(`Outbox dispatcher error: ${err.message}`);
      }

      const now = Date.now();
      if (now - lastReapAt >= REAP_INTERVAL_MS) {
        lastReapAt = now;
        try {
          await outboxDispatcher.reapStalledEvents(15 * 60 * 1000, 5);
        } catch (reapErr: any) {
          logger.error(`Outbox reaper error: ${reapErr.message}`);
        }
      }

      if (isRunning) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }
    }
  };

  void pollLoop();

  process.on("SIGTERM", async () => {
    logger.log("Worker shutdown requested");
    isRunning = false;
    await app.close();
    process.exit(0);
  });
}

void bootstrap();
