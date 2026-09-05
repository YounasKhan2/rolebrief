import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import * as cookieParser from "cookie-parser";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { AppConfigService } from "./common/config/app-config.service";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(AppConfigService);

  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  app.enableCors({
    origin: config.frontendOrigins,
    methods: ["GET", "HEAD", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Accept", "Content-Type", "x-rolebrief-csrf"],
    credentials: true
  });
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cookieParser());
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true
    })
  );

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("RoleBrief API")
      .setDescription("Provider-neutral career intelligence API with cookie-based authentication and RBAC")
      .setVersion("0.1.0")
      .addCookieAuth("rb_access")
      .build()
  );
  SwaggerModule.setup("api/docs", app, document);

  await app.listen(config.port);
}

void bootstrap();
