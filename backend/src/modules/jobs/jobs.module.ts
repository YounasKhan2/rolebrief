import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { JobsController } from "./jobs.controller";
import { JobsService } from "./jobs.service";

@Module({
  imports: [PrismaModule],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService]
})
export class JobsModule {}
