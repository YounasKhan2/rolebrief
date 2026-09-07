import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AppConfigModule } from "../../common/config/app-config.module";
import { ProfileController } from "./profile.controller";
import { ProfileService } from "./profile.service";

@Module({
  imports: [PrismaModule, AppConfigModule],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService]
})
export class ProfileModule {}
