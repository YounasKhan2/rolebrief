import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AppConfigModule } from "../../common/config/app-config.module";
import { JobsModule } from "../jobs/jobs.module";
import { TrackerController } from "./tracker.controller";
import { TrackerService } from "./tracker.service";

@Module({
  imports: [PrismaModule, AppConfigModule, JobsModule],
  controllers: [TrackerController],
  providers: [TrackerService],
  exports: [TrackerService]
})
export class TrackerModule {}
