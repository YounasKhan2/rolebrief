import { ResumeFailureCode } from "@prisma/client";

export class ResumePermanentValidationError extends Error {
  constructor(public readonly code: ResumeFailureCode) {
    super(code);
  }
}

export class ResumeRetryableProcessingError extends Error {
  constructor(public readonly code: ResumeFailureCode) {
    super(code);
  }
}
