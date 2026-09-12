import { Module } from "@nestjs/common";
import { AppConfigModule } from "../../common/config/app-config.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { StorageModule } from "../../infrastructure/storage/storage.module";
import { MalwareModule } from "../../infrastructure/malware/malware.module";
import { QueueModule } from "../../queue/queue.module";
import { ResumesController } from "./resumes.controller";
import { ResumeFileValidatorService } from "./processing/resume-file-validator.service";
import { ResumeProcessingService } from "./processing/resume-processing.service";
import { ResumeExtractionService } from "./processing/resume-extraction.service";
import { ResumeMapperService } from "./mapping/resume-mapper.service";
import { ResumeRateLimitService } from "./resume-rate-limit.service";
import { ResumeUploadService } from "./resume-upload.service";
import { DocumentParserModule } from "../../infrastructure/internal-services/document-parser/document-parser.module";

@Module({
  imports: [AppConfigModule, PrismaModule, StorageModule, MalwareModule, QueueModule, DocumentParserModule],
  controllers: [ResumesController],
  providers: [ResumeUploadService, ResumeRateLimitService, ResumeFileValidatorService, ResumeProcessingService, ResumeExtractionService, ResumeMapperService],
  exports: [ResumeUploadService, ResumeProcessingService, ResumeExtractionService]
})
export class ResumesModule {}
