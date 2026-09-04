import { Module } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { LoggerModule } from "nestjs-pino";
import { AppConfigModule } from "../config/app-config.module";
import { AppConfigService } from "../config/app-config.service";

@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        pinoHttp: {
          level: config.logLevel,
          redact: ["req.headers.authorization", "req.headers.cookie", "res.headers.set-cookie"],
          genReqId: (req) => req.headers["x-request-id"]?.toString() ?? randomUUID()
        }
      })
    })
  ]
})
export class LoggingModule {}
