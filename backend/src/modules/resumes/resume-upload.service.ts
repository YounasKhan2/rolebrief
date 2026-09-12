import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnsupportedMediaTypeException
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { ResumeDocumentStatus } from "@prisma/client";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { AppConfigService } from "../../common/config/app-config.service";
import { PrismaService } from "../../prisma/prisma.service";
import { S3StorageService } from "../../infrastructure/storage/s3-storage.service";
import { QUEUES, VERIFY_RESUME_UPLOAD_JOB } from "../../queue/queue.constants";
import { ConfirmResumeUploadDto, CreateResumeUploadSessionDto } from "./dto/resume-upload.dto";
import { ResumeRateLimitService } from "./resume-rate-limit.service";

const ALLOWED_TYPES = new Map([
  ["application/pdf", "pdf"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"]
]);

function safeFilename(filename: string) {
  const cleaned = filename.normalize("NFKC").replace(/[^\w.\- ]+/g, "_").replace(/\s+/g, " ").trim();
  return cleaned.slice(0, 180) || "resume";
}

@Injectable()
export class ResumeUploadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly storage: S3StorageService,
    private readonly rateLimit: ResumeRateLimitService,
    @InjectQueue(QUEUES.verification) private readonly verificationQueue: Queue
  ) {}

  async createUploadSession(userId: string, dto: CreateResumeUploadSessionDto, clientIp: string) {
    await this.rateLimit.consume({
      namespace: "upload-session:user",
      subject: userId,
      limit: this.config.resumes.rateLimits.uploadSession,
      windowSeconds: 60
    });
    await this.rateLimit.consume({
      namespace: "upload-session:ip",
      subject: clientIp || "unknown",
      limit: this.config.resumes.rateLimits.uploadSession * 3,
      windowSeconds: 60
    });

    const extension = this.validateUpload(dto.mimeType, dto.byteSize, dto.filename);
    const existing = await this.prisma.resumeDocument.findUnique({
      where: { userId_uploadIdempotencyKey: { userId, uploadIdempotencyKey: dto.idempotencyKey } }
    });
    if (existing) {
      if (existing.sha256 !== dto.sha256 || existing.byteSize !== dto.byteSize || existing.mimeType !== dto.mimeType) {
        throw new ConflictException("Upload session idempotency key was already used for different file metadata.");
      }
      return this.sessionResponse(existing);
    }

    const now = new Date();
    const objectKey = `users/${userId}/resumes/${now.getUTCFullYear()}/${randomBytes(18).toString("hex")}.${extension}`;
    const upload = this.storage.createPresignedPut({
      key: objectKey,
      contentType: dto.mimeType,
      contentLength: dto.byteSize,
      sha256: dto.sha256,
      expiresInSeconds: this.config.resumes.upload.urlTtlSeconds
    });

    const document = await this.prisma.resumeDocument.create({
      data: {
        userId,
        status: ResumeDocumentStatus.UPLOADING,
        originalFilenameSafe: safeFilename(dto.filename),
        mimeType: dto.mimeType,
        extension,
        byteSize: dto.byteSize,
        sha256: dto.sha256,
        objectKey,
        storageBucket: this.config.resumes.storage.bucket,
        uploadIdempotencyKey: dto.idempotencyKey,
        uploadExpiresAt: upload.expiresAt
      }
    });

    return {
      resumeDocumentId: document.id,
      status: document.status,
      upload: {
        url: upload.url,
        method: upload.method,
        headers: upload.headers,
        expiresAt: upload.expiresAt.toISOString()
      },
      maxBytes: this.config.resumes.upload.maxBytes
    };
  }

  async confirmUpload(userId: string, id: string, dto: ConfirmResumeUploadDto, clientIp: string) {
    await this.rateLimit.consume({
      namespace: "confirm-upload:user",
      subject: userId,
      limit: this.config.resumes.rateLimits.confirmUpload,
      windowSeconds: 60
    });
    await this.rateLimit.consume({
      namespace: "confirm-upload:ip",
      subject: clientIp || "unknown",
      limit: this.config.resumes.rateLimits.confirmUpload * 3,
      windowSeconds: 60
    });

    const document = await this.prisma.resumeDocument.findFirst({ where: { id, userId, deletedAt: null } });
    if (!document) throw new NotFoundException("Resume document not found.");
    if (document.status !== ResumeDocumentStatus.UPLOADING && document.status !== ResumeDocumentStatus.UPLOADED) {
      return this.confirmResponse(document);
    }
    if (document.sha256 !== dto.sha256 || document.byteSize !== dto.byteSize) {
      throw new ConflictException("Upload confirmation does not match the original upload session.");
    }
    if (document.uploadExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException("Upload session expired. Create a new upload session.");
    }

    const head = await this.storage.headObject(document.objectKey);
    if (!head.exists) {
      throw new NotFoundException("Uploaded object was not found in resume storage.");
    }
    if (head.contentLength !== document.byteSize) {
      throw new BadRequestException("Uploaded object size does not match the declared resume size.");
    }
    if (head.contentType && head.contentType.split(";")[0].trim().toLowerCase() !== document.mimeType) {
      throw new UnsupportedMediaTypeException("Uploaded object content type does not match the upload session.");
    }
    if (!head.sha256 || head.sha256.toLowerCase() !== document.sha256) {
      throw new BadRequestException("Uploaded object SHA-256 metadata does not match the declared checksum.");
    }

    const updated = await this.prisma.resumeDocument.update({
      where: { id: document.id },
      data: {
        status: ResumeDocumentStatus.UPLOADED,
        confirmedAt: new Date()
      }
    });
    await this.enqueueVerification(updated.id, updated.sha256);
    return this.confirmResponse(updated);
  }

  async getStatus(userId: string, id: string) {
    const document = await this.prisma.resumeDocument.findFirst({
      where: { id, userId, deletedAt: null },
      select: {
        id: true,
        status: true,
        failureCode: true,
        confirmedAt: true,
        verifiedAt: true,
        scannedAt: true,
        byteSize: true,
        mimeType: true,
        createdAt: true,
        updatedAt: true
      }
    });
    if (!document) throw new NotFoundException("Resume document not found.");
    return {
      resumeDocumentId: document.id,
      status: document.status,
      failureCode: document.failureCode,
      confirmedAt: document.confirmedAt?.toISOString() ?? null,
      verifiedAt: document.verifiedAt?.toISOString() ?? null,
      scannedAt: document.scannedAt?.toISOString() ?? null,
      byteSize: document.byteSize,
      mimeType: document.mimeType,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString()
    };
  }

  async retryVerification(userId: string, id: string, clientIp: string) {
    await this.rateLimit.consume({
      namespace: "retry-verification:user",
      subject: userId,
      limit: this.config.resumes.rateLimits.confirmUpload,
      windowSeconds: 60
    });
    await this.rateLimit.consume({
      namespace: "retry-verification:ip",
      subject: clientIp || "unknown",
      limit: this.config.resumes.rateLimits.confirmUpload * 3,
      windowSeconds: 60
    });
    const document = await this.prisma.resumeDocument.findFirst({ where: { id, userId, deletedAt: null } });
    if (!document) throw new NotFoundException("Resume document not found.");
    if (document.status === ResumeDocumentStatus.VERIFIED_CLEAN || document.status === ResumeDocumentStatus.REJECTED) {
      return this.getStatus(userId, id);
    }
    if (document.status !== ResumeDocumentStatus.FAILED && document.status !== ResumeDocumentStatus.UPLOADED) {
      throw new ConflictException("Resume verification is already active.");
    }
    await this.enqueueVerification(document.id, document.sha256, `retry-${document.processingAttemptCount + 1}`);
    return this.getStatus(userId, id);
  }

  private validateUpload(mimeType: string, byteSize: number, filename: string) {
    const extension = ALLOWED_TYPES.get(mimeType);
    if (!extension) {
      throw new UnsupportedMediaTypeException("Only PDF and DOCX resumes are supported.");
    }
    const filenameExtension = filename.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
    if (filenameExtension && filenameExtension !== extension) {
      throw new UnsupportedMediaTypeException("Resume filename extension must match the declared file type.");
    }
    if (byteSize > this.config.resumes.upload.maxBytes) {
      throw new BadRequestException("Resume uploads are limited to 10 MB.");
    }
    return extension;
  }

  private sessionResponse(document: { id: string; status: ResumeDocumentStatus; uploadExpiresAt: Date; objectKey: string; mimeType: string; byteSize: number; sha256: string }) {
    if (document.uploadExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException("Existing upload session expired. Use a new idempotency key to create another upload session.");
    }
    const upload = this.storage.createPresignedPut({
      key: document.objectKey,
      contentType: document.mimeType,
      contentLength: document.byteSize,
      sha256: document.sha256,
      expiresInSeconds: Math.max(1, Math.floor((document.uploadExpiresAt.getTime() - Date.now()) / 1000))
    });
    return {
      resumeDocumentId: document.id,
      status: document.status,
      upload: {
        url: upload.url,
        method: upload.method,
        headers: upload.headers,
        expiresAt: upload.expiresAt.toISOString()
      },
      maxBytes: this.config.resumes.upload.maxBytes
    };
  }

  private async enqueueVerification(id: string, sha256: string, suffix: string = "initial") {
    try {
      await this.verificationQueue.add(
        VERIFY_RESUME_UPLOAD_JOB,
        { version: 1, resumeDocumentId: id, expectedSha256: sha256 },
        {
          jobId: `${VERIFY_RESUME_UPLOAD_JOB}__${id}__${sha256}__${suffix}`,
          attempts: this.config.resumes.processing.maxAttempts,
          backoff: { type: "exponential", delay: 2000 },
          removeOnComplete: { age: 86400, count: 1000 },
          removeOnFail: { age: 604800, count: 1000 }
        }
      );
    } catch {
      throw new ServiceUnavailableException({
        message: "Resume verification queue is temporarily unavailable.",
        retryAfterSeconds: 30
      });
    }
  }

  private confirmResponse(document: { id: string; status: ResumeDocumentStatus; confirmedAt: Date | null; sha256: string; byteSize: number; mimeType: string }) {
    if (document.status !== ResumeDocumentStatus.UPLOADED) {
      return {
        resumeDocumentId: document.id,
        status: document.status,
        message: "Resume verification is already in progress or complete."
      };
    }
    return {
      resumeDocumentId: document.id,
      status: document.status,
      confirmedAt: document.confirmedAt?.toISOString() ?? null,
      byteSize: document.byteSize,
      mimeType: document.mimeType,
      next: "Verification and malware scanning are queued. The file remains quarantined until VERIFIED_CLEAN."
    };
  }
}
