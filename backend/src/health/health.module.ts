import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { AppConfigModule } from "../common/config/app-config.module";
import { PrismaModule } from "../prisma/prisma.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [AppConfigModule, PrismaModule, TerminusModule],
  controllers: [HealthController]
})
export class HealthModule {}
