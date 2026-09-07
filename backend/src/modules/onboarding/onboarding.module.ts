import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AppConfigModule } from "../../common/config/app-config.module";
import { ProfileModule } from "../profile/profile.module";
import { OnboardingController } from "./onboarding.controller";
import { OnboardingService } from "./onboarding.service";

@Module({
  imports: [PrismaModule, AppConfigModule, ProfileModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService]
})
export class OnboardingModule {}
