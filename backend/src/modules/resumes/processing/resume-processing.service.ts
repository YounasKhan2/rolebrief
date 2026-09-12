import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import {
  ResumeDocumentStatus,
  ResumeFailureCode,
  ResumeParseAttemptStatus
} from "@prisma/client";
import { AppConfigService } from "../../../common/config/app-config.service";
import { ClamAvScannerService } from "../../../infrastructure/malware/clamav-scanner.service";
import {
  MalwareScanTimeoutError,
  MalwareScannerProtocolError,
  MalwareScannerUnavailableError
} from "../../../infrastructure/malware/malware-scanner.types";
import { S3StorageService } from "../../../infrastructure/storage/s3-storage.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { ResumeFileValidatorService } from "./resume-file-validator.service";
import { ResumePermanentValidationError, ResumeRetryableProcessingError } from "./resume-validation.types";

export interface VerifyResumeUploadJobV1 {
  version: 1;
  resumeDocumentId: string;
  expectedSha256: string;
}

const VERIFICATION_VERSION = "resume-validation-v1";

@Injectable()
export class ResumeProcessingService {
  private readonly logger = new Logger(ResumeProcessingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly storage: S3StorageService,
    private readonly validator: ResumeFileValidatorService,
    private readonly scanner: ClamAvScannerService
  ) {}

  async process(job: VerifyResumeUploadJobV1) {
    const leaseToken = randomUUID();
    const document = await this.acquireLease(job.resumeDocumentId, job.expectedSha256, leaseToken);
    if (!document) return { skipped: true, reason: "not_acquired" };

    try {
      const head = await this.storage.headObject(document.objectKey);
      if (!head.exists) throw new ResumeRetryableProcessingError(ResumeFailureCode.STORAGE_UNAVAILABLE);
      if (head.contentLength !== document.byteSize) throw new ResumePermanentValidationError(ResumeFailureCode.SIZE_MISMATCH);
      if (!head.sha256 || head.sha256.toLowerCase() !== document.sha256) {
        throw new ResumePermanentValidationError(ResumeFailureCode.CHECKSUM_MISMATCH);
      }
      const bytes = await this.storage.getObjectBuffer(document.objectKey, this.config.resumes.upload.maxBytes + 1);
      await this.transition(document.id, leaseToken, ResumeDocumentStatus.VERIFYING, ResumeDocumentStatus.SCANNING);
      this.validator.validate({
        bytes,
        expectedSha256: document.sha256,
        expectedSize: document.byteSize,
        extension: document.extension
      });
      const scan = await this.scanner.scan(Readable.from(bytes), {
        maxBytes: this.config.resumes.upload.maxBytes,
        timeoutMs: this.config.resumes.scanning.timeoutMs
      });
      if (scan.status === "INFECTED") {
        throw new ResumePermanentValidationError(ResumeFailureCode.MALWARE_DETECTED);
      }
      await this.completeClean(document.id, leaseToken);
      return { verified: true };
    } catch (error) {
      await this.handleProcessingError(document.id, leaseToken, error);
      if (error instanceof ResumePermanentValidationError) return { rejected: true, code: error.code };
      throw error;
    }
  }

  async reclaimStalled() {
    const now = new Date();
    const result = await this.prisma.resumeDocument.updateMany({
      where: {
        status: { in: [ResumeDocumentStatus.VERIFYING, ResumeDocumentStatus.SCANNING] },
        deletedAt: null,
        processingLeaseExpiresAt: { lt: now }
      },
      data: {
        status: ResumeDocumentStatus.FAILED,
        failureCode: ResumeFailureCode.STORAGE_UNAVAILABLE,
        failureMessageSafe: "Processing lease expired.",
        processingLeaseToken: null,
        processingLeaseExpiresAt: null
      }
    });
    if (result.count > 0) {
      this.logger.warn({ event: "resume.processing.reclaimed_stalled", count: result.count });
    }
    return result.count;
  }

  private async acquireLease(id: string, expectedSha256: string, leaseToken: string) {
    const now = new Date();
    const leaseExpiresAt = new Date(now.getTime() + this.config.resumes.processing.leaseSeconds * 1000);
    const current = await this.prisma.resumeDocument.findUnique({ where: { id } });
    if (!current || current.deletedAt || current.sha256 !== expectedSha256) return null;
    if (current.status === ResumeDocumentStatus.VERIFIED_CLEAN || current.status === ResumeDocumentStatus.REJECTED || current.status === ResumeDocumentStatus.DELETED) {
      return null;
    }
    if (current.processingAttemptCount >= this.config.resumes.processing.maxAttempts) {
      await this.prisma.resumeDocument.update({
        where: { id },
        data: {
          status: ResumeDocumentStatus.FAILED,
          failureCode: ResumeFailureCode.PROCESSING_ATTEMPTS_EXHAUSTED,
          failureMessageSafe: "Resume processing attempts exhausted."
        }
      });
      return null;
    }
    const result = await this.prisma.resumeDocument.updateMany({
      where: {
        id,
        sha256: expectedSha256,
        deletedAt: null,
        status: { in: [ResumeDocumentStatus.UPLOADED, ResumeDocumentStatus.FAILED] },
        OR: [{ processingLeaseExpiresAt: null }, { processingLeaseExpiresAt: { lt: now } }]
      },
      data: {
        status: ResumeDocumentStatus.VERIFYING,
        failureCode: null,
        failureMessageSafe: null,
        processingLeaseToken: leaseToken,
        processingLeaseExpiresAt: leaseExpiresAt,
        processingStartedAt: now,
        processingAttemptCount: { increment: 1 },
        verificationVersion: VERIFICATION_VERSION
      }
    });
    if (result.count !== 1) return null;
    const locked = await this.prisma.resumeDocument.findUniqueOrThrow({ where: { id } });
    await this.prisma.resumeParseAttempt.create({
      data: {
        resumeDocumentId: id,
        status: ResumeParseAttemptStatus.RUNNING,
        queueJobId: `verify__${id}__${locked.processingAttemptCount}`,
        attempt: locked.processingAttemptCount,
        startedAt: now
      }
    }).catch(() => undefined);
    return locked;
  }

  private async transition(id: string, leaseToken: string, from: ResumeDocumentStatus, to: ResumeDocumentStatus) {
    const result = await this.prisma.resumeDocument.updateMany({
      where: { id, status: from, processingLeaseToken: leaseToken, deletedAt: null },
      data: { status: to }
    });
    if (result.count !== 1) throw new ResumeRetryableProcessingError(ResumeFailureCode.STORAGE_UNAVAILABLE);
  }

  private async completeClean(id: string, leaseToken: string) {
    const now = new Date();
    const result = await this.prisma.resumeDocument.updateMany({
      where: { id, status: ResumeDocumentStatus.SCANNING, processingLeaseToken: leaseToken, deletedAt: null },
      data: {
        status: ResumeDocumentStatus.VERIFIED_CLEAN,
        verifiedAt: now,
        scannedAt: now,
        scannedCleanAt: now,
        scannerName: "clamav",
        scannerVersion: "clamav-instream",
        scannerDefinitionVersion: "runtime",
        processingLeaseToken: null,
        processingLeaseExpiresAt: null,
        failureCode: null,
        failureMessageSafe: null
      }
    });
    if (result.count !== 1) throw new ResumeRetryableProcessingError(ResumeFailureCode.STORAGE_UNAVAILABLE);
    await this.prisma.resumeParseAttempt.updateMany({
      where: { resumeDocumentId: id, status: ResumeParseAttemptStatus.RUNNING },
      data: { status: ResumeParseAttemptStatus.SUCCEEDED, completedAt: now }
    });
  }

  private async handleProcessingError(id: string, leaseToken: string, error: unknown) {
    const code = this.classify(error);
    const permanent = error instanceof ResumePermanentValidationError;
    const status = permanent ? ResumeDocumentStatus.REJECTED : ResumeDocumentStatus.FAILED;
    const now = new Date();
    await this.prisma.resumeDocument.updateMany({
      where: {
        id,
        processingLeaseToken: leaseToken,
        deletedAt: null,
        status: { in: [ResumeDocumentStatus.VERIFYING, ResumeDocumentStatus.SCANNING] }
      },
      data: {
        status,
        failureCode: code,
        failureMessageSafe: permanent ? "Resume file failed validation." : "Resume processing dependency is temporarily unavailable.",
        processingLeaseToken: null,
        processingLeaseExpiresAt: null,
        scannedAt: status === ResumeDocumentStatus.REJECTED && code === ResumeFailureCode.MALWARE_DETECTED ? now : undefined,
        retentionDeleteAt: status === ResumeDocumentStatus.REJECTED ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) : undefined
      }
    });
    await this.prisma.resumeParseAttempt.updateMany({
      where: { resumeDocumentId: id, status: ResumeParseAttemptStatus.RUNNING },
      data: { status: ResumeParseAttemptStatus.FAILED, failedAt: now, failureCode: code }
    });
  }

  private classify(error: unknown): ResumeFailureCode {
    if (error instanceof ResumePermanentValidationError) return error.code;
    if (error instanceof ResumeRetryableProcessingError) return error.code;
    if (error instanceof MalwareScanTimeoutError) return ResumeFailureCode.SCAN_TIMEOUT;
    if (error instanceof MalwareScannerUnavailableError || error instanceof MalwareScannerProtocolError) {
      return ResumeFailureCode.SCANNER_UNAVAILABLE;
    }
    if (error instanceof ServiceUnavailableException) return ResumeFailureCode.STORAGE_UNAVAILABLE;
    return ResumeFailureCode.STORAGE_UNAVAILABLE;
  }
}
