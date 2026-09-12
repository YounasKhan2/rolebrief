import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import {
  ResumeDocumentStatus,
  ResumeDraftStatus,
  ResumeFailureCode,
  ResumeParseAttemptStatus
} from "@prisma/client";
import { Queue } from "bullmq";
import { createHash, randomUUID } from "node:crypto";
import { gzipSync } from "node:zlib";
import { AppConfigService } from "../../../common/config/app-config.service";
import {
  DOCLING_EXTRACTION_VERSION,
  DoclingExtraction
} from "../../../infrastructure/internal-services/docling/docling-contract";
import {
  DoclingClientService,
  DoclingOutputInvalidError,
  DoclingOutputTooLargeError,
  DoclingProtocolError,
  DoclingTimeoutError,
  DoclingUnavailableError
} from "../../../infrastructure/internal-services/docling/docling-client.service";
import { S3StorageService } from "../../../infrastructure/storage/s3-storage.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { EXTRACT_VERIFIED_RESUME_JOB, QUEUES } from "../../../queue/queue.constants";
import { RESUME_MAPPER_VERSION, ResumeMapperService } from "../mapping/resume-mapper.service";
import { ResumePermanentValidationError, ResumeRetryableProcessingError } from "./resume-validation.types";

export interface ExtractVerifiedResumeJobV1 {
  version: 1;
  resumeDocumentId: string;
  sourceSha256: string;
  extractionVersion: string;
  mapperVersion: string;
}

const PARSER_VERSION = "docling-service-v1";

@Injectable()
export class ResumeExtractionService {
  private readonly logger = new Logger(ResumeExtractionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly storage: S3StorageService,
    private readonly docling: DoclingClientService,
    private readonly mapper: ResumeMapperService,
    @InjectQueue(QUEUES.verification) private readonly verificationQueue: Queue
  ) {}

  async enqueue(id: string, sourceSha256: string, suffix = "initial") {
    await this.verificationQueue.add(
      EXTRACT_VERIFIED_RESUME_JOB,
      { version: 1, resumeDocumentId: id, sourceSha256, extractionVersion: DOCLING_EXTRACTION_VERSION, mapperVersion: RESUME_MAPPER_VERSION },
      {
        jobId: `${EXTRACT_VERIFIED_RESUME_JOB}__${id}__${sourceSha256}__${RESUME_MAPPER_VERSION}__${suffix}`,
        attempts: this.config.resumes.processing.maxAttempts,
        backoff: { type: "exponential", delay: 3000 },
        removeOnComplete: { age: 86400, count: 1000 },
        removeOnFail: { age: 604800, count: 1000 }
      }
    );
  }

  async reconcileVerifiedClean(limit = this.config.resumes.extraction.maxReconcile) {
    const rows = await this.prisma.resumeDocument.findMany({
      where: { status: ResumeDocumentStatus.VERIFIED_CLEAN, deletedAt: null },
      select: { id: true, sha256: true, currentDraftId: true },
      orderBy: { updatedAt: "asc" },
      take: limit
    });
    let queued = 0;
    for (const row of rows) {
      if (row.currentDraftId) continue;
      try {
        await this.enqueue(row.id, row.sha256, "reconcile");
        queued += 1;
      } catch {
        break;
      }
    }
    return queued;
  }

  async reclaimStalled() {
    const now = new Date();
    const result = await this.prisma.resumeDocument.updateMany({
      where: {
        status: { in: [ResumeDocumentStatus.EXTRACTING, ResumeDocumentStatus.MAPPING] },
        deletedAt: null,
        processingLeaseExpiresAt: { lt: now }
      },
      data: {
        status: ResumeDocumentStatus.FAILED,
        failureCode: ResumeFailureCode.DOCLING_UNAVAILABLE,
        failureMessageSafe: "Extraction lease expired.",
        processingLeaseToken: null,
        processingLeaseExpiresAt: null
      }
    });
    if (result.count > 0) this.logger.warn({ event: "resume.extraction.reclaimed_stalled", count: result.count });
    return result.count;
  }

  async process(job: ExtractVerifiedResumeJobV1) {
    const leaseToken = randomUUID();
    const document = await this.acquireLease(job.resumeDocumentId, job.sourceSha256, leaseToken);
    if (!document) return { skipped: true, reason: "not_acquired" };

    try {
      const head = await this.storage.headObject(document.objectKey);
      if (!head.exists) throw new ResumeRetryableProcessingError(ResumeFailureCode.STORAGE_UNAVAILABLE);
      if (head.contentLength !== document.byteSize || head.sha256 !== document.sha256) {
        throw new ResumePermanentValidationError(ResumeFailureCode.CHECKSUM_MISMATCH);
      }

      const bytes = await this.storage.getObjectBuffer(document.objectKey, this.config.resumes.upload.maxBytes + 1);
      const extraction = await this.docling.extract({
        documentRef: `resume:${document.id}`,
        mediaType: document.mimeType,
        bytes,
        ocrPolicy: "auto",
        deadlineMs: this.config.resumes.extraction.timeoutMs
      });
      this.validateExtraction(extraction);
      const artifact = await this.storeArtifact(document.id, document.sha256, extraction);

      await this.transition(document.id, leaseToken, ResumeDocumentStatus.EXTRACTING, ResumeDocumentStatus.MAPPING, {
        parserVersion: extraction.parserVersion
      });

      const mapped = this.mapper.map(extraction, { artifactId: artifact.sha256, sourceChecksum: document.sha256 });
      if (mapped.items.length === 0) throw new ResumePermanentValidationError(ResumeFailureCode.NO_USABLE_CONTENT);
      const draft = await this.prisma.resumeExtractionDraft.upsert({
        where: {
          resumeDocumentId_sourceChecksum_mapperVersion: {
            resumeDocumentId: document.id,
            sourceChecksum: document.sha256,
            mapperVersion: job.mapperVersion
          }
        },
        update: {
          status: ResumeDraftStatus.READY_FOR_REVIEW,
          parserVersion: extraction.parserVersion,
          extractionVersion: job.extractionVersion,
          artifactObjectKey: artifact.key,
          artifactSha256: artifact.sha256,
          artifactByteSize: artifact.byteSize,
          artifactContentType: "application/json",
          artifactCompression: "gzip",
          itemsJson: mapped.items as any,
          summaryJson: mapped.summary,
          warningsJson: mapped.warnings as any
        },
        create: {
          resumeDocumentId: document.id,
          userId: document.userId,
          status: ResumeDraftStatus.READY_FOR_REVIEW,
          schemaVersion: 1,
          parserVersion: extraction.parserVersion,
          extractionVersion: job.extractionVersion,
          mapperVersion: job.mapperVersion,
          sourceChecksum: document.sha256,
          artifactObjectKey: artifact.key,
          artifactSha256: artifact.sha256,
          artifactByteSize: artifact.byteSize,
          artifactContentType: "application/json",
          artifactCompression: "gzip",
          itemsJson: mapped.items as any,
          summaryJson: mapped.summary,
          warningsJson: mapped.warnings as any,
          targetProfileRevision: null
        }
      });
      await this.completeReady(document.id, leaseToken, draft.id, extraction.parserVersion, job.mapperVersion, artifact, extraction);
      return { readyForReview: true };
    } catch (error) {
      await this.handleProcessingError(document.id, leaseToken, error);
      if (error instanceof ResumePermanentValidationError) return { failed: true, code: error.code };
      throw error;
    }
  }

  private async acquireLease(id: string, sourceSha256: string, leaseToken: string) {
    const now = new Date();
    const leaseExpiresAt = new Date(now.getTime() + this.config.resumes.processing.leaseSeconds * 1000);
    const current = await this.prisma.resumeDocument.findUnique({
      where: { id },
      include: { user: true }
    });
    if (!current || current.deletedAt || current.sha256 !== sourceSha256) return null;
    if (current.status === ResumeDocumentStatus.READY_FOR_REVIEW || current.status === ResumeDocumentStatus.REJECTED || current.status === ResumeDocumentStatus.DELETED) return null;
    if (current.processingAttemptCount >= this.config.resumes.processing.maxAttempts) {
      await this.prisma.resumeDocument.update({
        where: { id },
        data: { status: ResumeDocumentStatus.FAILED, failureCode: ResumeFailureCode.PROCESSING_ATTEMPTS_EXHAUSTED, failureMessageSafe: "Resume extraction attempts exhausted." }
      });
      return null;
    }
    const result = await this.prisma.resumeDocument.updateMany({
      where: {
        id,
        sha256: sourceSha256,
        deletedAt: null,
        status: { in: [ResumeDocumentStatus.VERIFIED_CLEAN, ResumeDocumentStatus.FAILED] },
        OR: [{ processingLeaseExpiresAt: null }, { processingLeaseExpiresAt: { lt: now } }]
      },
      data: {
        status: ResumeDocumentStatus.EXTRACTING,
        failureCode: null,
        failureMessageSafe: null,
        processingLeaseToken: leaseToken,
        processingLeaseExpiresAt: leaseExpiresAt,
        processingStartedAt: now,
        processingAttemptCount: { increment: 1 }
      }
    });
    if (result.count !== 1) return null;
    const locked = await this.prisma.resumeDocument.findUniqueOrThrow({
      where: { id },
      include: { user: true }
    });
    await this.prisma.resumeParseAttempt.create({
      data: {
        resumeDocumentId: id,
        status: ResumeParseAttemptStatus.RUNNING,
        queueJobId: `extract__${id}__${locked.processingAttemptCount}`,
        attempt: locked.processingAttemptCount,
        startedAt: now
      }
    }).catch(() => undefined);
    return locked;
  }

  private validateExtraction(extraction: DoclingExtraction) {
    const cfg = this.config.resumes.extraction;
    const totalText = extraction.blocks.reduce((sum, block) => sum + Buffer.byteLength(block.text, "utf8"), 0);
    if (extraction.blocks.length === 0 || totalText === 0) throw new ResumePermanentValidationError(ResumeFailureCode.NO_USABLE_CONTENT);
    if (extraction.blocks.length > cfg.maxBlocks || totalText > cfg.maxTextBytes) {
      throw new ResumePermanentValidationError(ResumeFailureCode.DOCLING_OUTPUT_TOO_LARGE);
    }
    if (extraction.blocks.some((block) => Buffer.byteLength(block.text, "utf8") > cfg.maxBlockTextBytes)) {
      throw new ResumePermanentValidationError(ResumeFailureCode.DOCLING_OUTPUT_TOO_LARGE);
    }
  }

  private async storeArtifact(id: string, sourceSha256: string, extraction: DoclingExtraction) {
    const normalized = Buffer.from(JSON.stringify(extraction));
    const body = gzipSync(normalized);
    const key = `resumes/artifacts/${id}/${sourceSha256}/${DOCLING_EXTRACTION_VERSION}/${extraction.parserVersion}.json.gz`;
    const put = await this.storage.putObjectBuffer({
      key,
      body,
      contentType: "application/json",
      metadata: { compression: "gzip", extractionVersion: DOCLING_EXTRACTION_VERSION, parserVersion: extraction.parserVersion }
    }).catch(() => {
      throw new ResumeRetryableProcessingError(ResumeFailureCode.EXTRACTION_ARTIFACT_WRITE_FAILED);
    });
    return { key, ...put };
  }

  private async transition(id: string, leaseToken: string, from: ResumeDocumentStatus, to: ResumeDocumentStatus, data: Record<string, any> = {}) {
    const result = await this.prisma.resumeDocument.updateMany({
      where: { id, status: from, processingLeaseToken: leaseToken, deletedAt: null },
      data: { status: to, ...data }
    });
    if (result.count !== 1) throw new ResumeRetryableProcessingError(ResumeFailureCode.DOCLING_UNAVAILABLE);
  }

  private async completeReady(id: string, leaseToken: string, draftId: string, parserVersion: string, mapperVersion: string, artifact: { key: string; sha256: string; byteSize: number }, extraction: DoclingExtraction) {
    const now = new Date();
    const result = await this.prisma.resumeDocument.updateMany({
      where: { id, status: ResumeDocumentStatus.MAPPING, processingLeaseToken: leaseToken, deletedAt: null },
      data: {
        status: ResumeDocumentStatus.READY_FOR_REVIEW,
        currentDraftId: draftId,
        parserVersion,
        mapperVersion,
        processingLeaseToken: null,
        processingLeaseExpiresAt: null,
        failureCode: null,
        failureMessageSafe: null
      }
    });
    if (result.count !== 1) throw new ResumeRetryableProcessingError(ResumeFailureCode.MAPPER_FAILED);
    await this.prisma.resumeParseAttempt.updateMany({
      where: { resumeDocumentId: id, status: ResumeParseAttemptStatus.RUNNING },
      data: {
        status: ResumeParseAttemptStatus.SUCCEEDED,
        completedAt: now,
        doclingArtifactObjectKey: artifact.key,
        artifactSha256: artifact.sha256,
        artifactByteSize: artifact.byteSize,
        artifactContentType: "application/json",
        artifactCompression: "gzip",
        metricsJson: extraction.metrics
      }
    });
  }

  private async handleProcessingError(id: string, leaseToken: string, error: unknown) {
    const code = this.classify(error);
    const now = new Date();
    await this.prisma.resumeDocument.updateMany({
      where: {
        id,
        processingLeaseToken: leaseToken,
        deletedAt: null,
        status: { in: [ResumeDocumentStatus.EXTRACTING, ResumeDocumentStatus.MAPPING] }
      },
      data: {
        status: ResumeDocumentStatus.FAILED,
        failureCode: code,
        failureMessageSafe: "Resume extraction or mapping failed safely.",
        processingLeaseToken: null,
        processingLeaseExpiresAt: null
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
    if (error instanceof DoclingTimeoutError) return ResumeFailureCode.DOCLING_TIMEOUT;
    if (error instanceof DoclingUnavailableError) return ResumeFailureCode.DOCLING_UNAVAILABLE;
    if (error instanceof DoclingProtocolError) return ResumeFailureCode.DOCLING_PROTOCOL_ERROR;
    if (error instanceof DoclingOutputTooLargeError) return ResumeFailureCode.DOCLING_OUTPUT_TOO_LARGE;
    if (error instanceof DoclingOutputInvalidError) return ResumeFailureCode.DOCLING_OUTPUT_INVALID;
    if (error instanceof ServiceUnavailableException) return ResumeFailureCode.STORAGE_UNAVAILABLE;
    return ResumeFailureCode.MAPPER_FAILED;
  }
}
