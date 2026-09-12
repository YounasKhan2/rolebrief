import { Module } from "@nestjs/common";
import { AppConfigModule } from "../../common/config/app-config.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { StorageModule } from "../../infrastructure/storage/storage.module";
import { MalwareModule } from "../../infrastructure/malware/malware.module";
import { QueueModule } from "../../queue/queue.module";
import { ResumesController } from "./resumes.controller";
import { ResumeFileValidatorService } from "./processing/resume-file-validator.service";
import { ResumeProcessingService } from "./processing/resume-processing.service";
import { ResumeRateLimitService } from "./resume-rate-limit.service";
import { ResumeUploadService } from "./resume-upload.service";

@Module({
  imports: [AppConfigModule, PrismaModule, StorageModule, MalwareModule, QueueModule],
  controllers: [ResumesController],
  providers: [ResumeUploadService, ResumeRateLimitService, ResumeFileValidatorService, ResumeProcessingService],
  exports: [ResumeUploadService, ResumeProcessingService]
})
export class ResumesModule {}
