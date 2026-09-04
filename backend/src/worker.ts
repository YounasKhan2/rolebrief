import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { WorkerModule } from "./worker.module";

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true
  });
  app.useLogger(app.get(Logger));

  const logger = app.get(Logger);
  process.on("SIGTERM", async () => {
    logger.log("Worker shutdown requested");
    await app.close();
    process.exit(0);
  });
}

void bootstrap();
