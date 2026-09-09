import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { HimalayasSchedulerService } from "./scheduler/himalayas-scheduler.service";
import { AlertDigestSchedulerService } from "./scheduler/alert-digest-scheduler.service";
import { SchedulerModule } from "./scheduler.module";

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(SchedulerModule, {
    bufferLogs: true
  });
  app.useLogger(app.get(Logger));
  await app.get(HimalayasSchedulerService).syncSchedule();

  const logger = app.get(Logger);
  const digestScheduler = app.get(AlertDigestSchedulerService);

  let isRunning = true;
  // Check digests every 15 minutes to process any due for the current UTC hour
  const digestIntervalMs = 15 * 60 * 1000;
  let lastCheckedHour = -1;

  const digestLoop = async () => {
    while (isRunning) {
      try {
        const currentHour = new Date().getUTCHours();
        if (currentHour !== lastCheckedHour) {
          logger.log(`Processing alert digests for UTC hour ${currentHour}`);
          await digestScheduler.processDigests(currentHour);
          lastCheckedHour = currentHour;
        }
      } catch (err: any) {
        logger.error(`Digest scheduler error: ${err.message}`);
      }
      if (isRunning) {
        await new Promise((resolve) => setTimeout(resolve, digestIntervalMs));
      }
    }
  };

  void digestLoop();

  process.on("SIGTERM", async () => {
    logger.log("Scheduler shutdown requested");
    isRunning = false;
    await app.close();
    process.exit(0);
  });
}

void bootstrap();
