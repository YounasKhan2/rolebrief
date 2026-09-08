import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AppConfigModule } from "../common/config/app-config.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { RolesGuard } from "./roles.guard";
import { CsrfGuard } from "./csrf.guard";
import { AuthService } from "./auth.service";
import { PasswordService } from "./password.service";
import { EmailModule } from "./email/email.module";
import { AuthRateLimitService } from "./rate-limit.service";

@Module({
  imports: [AppConfigModule, PrismaModule, EmailModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    AuthRateLimitService,
    CsrfGuard,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard }
  ],
  exports: [AuthService, PasswordService, CsrfGuard, AuthRateLimitService]
})
export class AuthModule {}
