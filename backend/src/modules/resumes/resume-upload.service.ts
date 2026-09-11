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
import { AppConfigService } from "../../common/config/app-config.service";
import { PrismaService } from "../../prisma/prisma.service";
import { S3StorageService } from "../../infrastructure/storage/s3-storage.service";
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
    private readonly rateLimit: ResumeRateLimitService
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
    return this.confirmResponse(updated);
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

  private confirmResponse(document: { id: string; status: ResumeDocumentStatus; confirmedAt: Date | null; sha256: string; byteSize: number; mimeType: string }) {
    if (document.status !== ResumeDocumentStatus.UPLOADED) {
      throw new ServiceUnavailableException("Resume upload is not ready for the next processing boundary.");
    }
    return {
      resumeDocumentId: document.id,
      status: document.status,
      confirmedAt: document.confirmedAt?.toISOString() ?? null,
      sha256: document.sha256,
      byteSize: document.byteSize,
      mimeType: document.mimeType,
      next: "Verification and malware scanning are intentionally handled in the next implementation boundary."
    };
  }
}
