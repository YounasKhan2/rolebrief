import { Module } from "@nestjs/common";
import { AppConfigModule } from "../config/app-config.module";
import { RateLimitService } from "./rate-limit.service";

@Module({
  imports: [AppConfigModule],
  providers: [RateLimitService],
  exports: [RateLimitService]
})
export class RateLimitModule {}
