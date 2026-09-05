import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { AuthService } from "./auth/auth.service";

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error", "warn", "log"] });
  try {
    const auth = app.get(AuthService);
    const result = await auth.bootstrapAdmin();
    console.log(JSON.stringify(result));
  } finally {
    await app.close();
  }
}

void run();
