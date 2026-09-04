import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { SchedulerModule } from "./scheduler.module";

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(SchedulerModule, {
    bufferLogs: true
  });
  app.useLogger(app.get(Logger));

  const logger = app.get(Logger);
  process.on("SIGTERM", async () => {
    logger.log("Scheduler shutdown requested");
    await app.close();
    process.exit(0);
  });
}

void bootstrap();
