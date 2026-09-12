import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Job, UnrecoverableError } from "bullmq";
import { EXTRACT_VERIFIED_RESUME_JOB, QUEUES, VERIFY_RESUME_UPLOAD_JOB } from "../../../queue/queue.constants";
import { ExtractVerifiedResumeJobV1, ResumeExtractionService } from "./resume-extraction.service";
import { ResumeProcessingService, VerifyResumeUploadJobV1 } from "./resume-processing.service";

@Injectable()
@Processor(QUEUES.verification)
export class ResumeVerificationProcessor extends WorkerHost {
  constructor(
    private readonly processing: ResumeProcessingService,
    private readonly extraction: ResumeExtractionService
  ) {
    super();
  }

  async process(job: Job) {
    await this.processing.reclaimStalled();
    await this.extraction.reclaimStalled();
    await this.extraction.reconcileVerifiedClean();
    if (job.name === EXTRACT_VERIFIED_RESUME_JOB) {
      const data = job.data as ExtractVerifiedResumeJobV1;
      if (data.version !== 1 || !data.resumeDocumentId || !data.sourceSha256 || !data.extractionVersion || !data.mapperVersion) {
        throw new UnrecoverableError("Invalid resume extraction job payload.");
      }
      return this.extraction.process(data);
    }
    if (job.name !== VERIFY_RESUME_UPLOAD_JOB) {
      return { skipped: true, reason: `Unsupported resume job ${job.name}` };
    }
    const data = job.data as VerifyResumeUploadJobV1;
    if (data.version !== 1 || !data.resumeDocumentId || !data.expectedSha256) {
      throw new UnrecoverableError("Invalid resume verification job payload.");
    }
    return this.processing.process(data);
  }
}
