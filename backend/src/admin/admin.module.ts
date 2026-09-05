import { Module } from "@nestjs/common";
import { AppConfigModule } from "../common/config/app-config.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { AdminController } from "./admin.controller";
import { CsrfGuard } from "../auth/csrf.guard";

@Module({
  imports: [AppConfigModule, PrismaModule, AuthModule],
  controllers: [AdminController],
  providers: [CsrfGuard]
})
export class AdminModule {}
