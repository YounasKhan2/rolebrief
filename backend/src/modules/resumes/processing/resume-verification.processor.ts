import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Job, UnrecoverableError } from "bullmq";
import { QUEUES, VERIFY_RESUME_UPLOAD_JOB } from "../../../queue/queue.constants";
import { ResumeProcessingService, VerifyResumeUploadJobV1 } from "./resume-processing.service";

@Injectable()
@Processor(QUEUES.verification)
export class ResumeVerificationProcessor extends WorkerHost {
  constructor(private readonly processing: ResumeProcessingService) {
    super();
  }

  async process(job: Job) {
    await this.processing.reclaimStalled();
    if (job.name !== VERIFY_RESUME_UPLOAD_JOB) {
      return { skipped: true, reason: `Unsupported verification job ${job.name}` };
    }
    const data = job.data as VerifyResumeUploadJobV1;
    if (data.version !== 1 || !data.resumeDocumentId || !data.expectedSha256) {
      throw new UnrecoverableError("Invalid resume verification job payload.");
    }
    return this.processing.process(data);
  }
}
