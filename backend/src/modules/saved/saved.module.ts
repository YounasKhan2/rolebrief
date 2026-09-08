import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AppConfigModule } from "../../common/config/app-config.module";
import { JobsModule } from "../jobs/jobs.module";
import { SavedController } from "./saved.controller";
import { SavedService } from "./saved.service";

@Module({
  imports: [PrismaModule, AppConfigModule, JobsModule],
  controllers: [SavedController],
  providers: [SavedService],
  exports: [SavedService]
})
export class SavedModule {}
