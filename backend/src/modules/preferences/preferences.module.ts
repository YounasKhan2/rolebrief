import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AppConfigModule } from "../../common/config/app-config.module";
import { RateLimitModule } from "../../common/rate-limit/rate-limit.module";
import { PreferencesController } from "./preferences.controller";
import { PreferencesService } from "./preferences.service";

@Module({
  imports: [PrismaModule, AppConfigModule, RateLimitModule],
  controllers: [PreferencesController],
  providers: [PreferencesService],
  exports: [PreferencesService]
})
export class PreferencesModule {}
