import { Module } from "@nestjs/common";
import { AppConfigModule } from "../../common/config/app-config.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { JobsController } from "./jobs.controller";
import { JobsSearchRepository } from "./jobs-search.repository";
import { JobsService } from "./jobs.service";

@Module({
  imports: [PrismaModule, AppConfigModule],
  controllers: [JobsController],
  providers: [JobsService, JobsSearchRepository],
  exports: [JobsService, JobsSearchRepository]
})
export class JobsModule {}
