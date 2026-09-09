import { Module } from "@nestjs/common";
import { AppConfigModule } from "../common/config/app-config.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { QueueModule } from "../queue/queue.module";
import { RateLimitModule } from "../common/rate-limit/rate-limit.module";
import { AdminController } from "./admin.controller";
import { AdminOperationsService } from "./admin-operations.service";
import { CsrfGuard } from "../auth/csrf.guard";

@Module({
  imports: [AppConfigModule, PrismaModule, AuthModule, QueueModule, RateLimitModule],
  controllers: [AdminController],
  providers: [AdminOperationsService, CsrfGuard],
  exports: [AdminOperationsService]
})
export class AdminModule {}

