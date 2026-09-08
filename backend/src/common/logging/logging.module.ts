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
          redact: {
            paths: [
              "req.headers.authorization",
              "req.headers.cookie",
              "req.headers['x-rolebrief-csrf']",
              "res.headers['set-cookie']",
              "password",
              "token",
              "secret",
              "notes",
              "nextAction",
              "contactName",
              "contactEmail",
              "sourceUrl",
              "applicationUrl",
              "bio",
              "headline",
              "minSalary",
              "maxSalary",
              "workAuthorizations",
              "requiresVisaSponsorship",
              "*.password",
              "*.token",
              "*.secret",
              "*.notes",
              "*.nextAction",
              "*.contactName",
              "*.contactEmail",
              "*.sourceUrl",
              "*.applicationUrl",
              "*.bio",
              "*.headline",
              "*.minSalary",
              "*.maxSalary",
              "*.workAuthorizations",
              "*.requiresVisaSponsorship"
            ],
            censor: "[REDACTED]"
          },
          genReqId: (req) => req.headers["x-request-id"]?.toString() ?? randomUUID(),
          serializers: {
            req: (req: any) => ({
              id: req.id,
              method: req.method,
              // Strip query parameters to prevent leaking tokens, cursors, or revisions in log URLs
              url: req.url ? req.url.split("?")[0] : req.url,
              userId: req.raw?.user?.id || undefined
            }),
            res: (res: any) => ({
              statusCode: res.statusCode
            }),
            err: (err: any) => ({
              type: err.type,
              message: err.message,
              stack: config.nodeEnv === "production" ? undefined : err.stack
            })
          }
        }
      })
    })
  ]
})
export class LoggingModule {}
