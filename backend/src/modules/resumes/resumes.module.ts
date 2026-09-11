import { Module } from "@nestjs/common";
import { AppConfigModule } from "../../common/config/app-config.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { StorageModule } from "../../infrastructure/storage/storage.module";
import { ResumesController } from "./resumes.controller";
import { ResumeRateLimitService } from "./resume-rate-limit.service";
import { ResumeUploadService } from "./resume-upload.service";

@Module({
  imports: [AppConfigModule, PrismaModule, StorageModule],
  controllers: [ResumesController],
  providers: [ResumeUploadService, ResumeRateLimitService],
  exports: [ResumeUploadService]
})
export class ResumesModule {}
