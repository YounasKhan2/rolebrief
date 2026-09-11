import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException, UnsupportedMediaTypeException } from "@nestjs/common";
import { ResumeDocumentStatus } from "@prisma/client";
import { ResumeUploadService } from "./resume-upload.service";

const sha = "a".repeat(64);

function config() {
  return {
    resumes: {
      upload: { maxBytes: 10 * 1024 * 1024, urlTtlSeconds: 300 },
      rateLimits: { uploadSession: 8, confirmUpload: 12 },
      storage: { bucket: "rolebrief-resumes" }
    }
  };
}

function createService(overrides: {
  prisma?: any;
  storage?: any;
  rateLimit?: any;
} = {}) {
  const docs = new Map<string, any>();
  const byIdempotency = new Map<string, any>();
  const prisma = overrides.prisma ?? {
    resumeDocument: {
      findUnique: async ({ where }: any) => byIdempotency.get(`${where.userId_uploadIdempotencyKey.userId}:${where.userId_uploadIdempotencyKey.uploadIdempotencyKey}`) ?? null,
      create: async ({ data }: any) => {
        const row = {
          ...data,
          id: "res_doc_1",
          confirmedAt: null,
          deletedAt: null,
          uploadExpiresAt: data.uploadExpiresAt,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        docs.set(row.id, row);
        byIdempotency.set(`${row.userId}:${row.uploadIdempotencyKey}`, row);
        return row;
      },
      findFirst: async ({ where }: any) => {
        const row = docs.get(where.id);
        return row && row.userId === where.userId && row.deletedAt === where.deletedAt ? row : null;
      },
      update: async ({ where, data }: any) => {
        const current = docs.get(where.id);
        const updated = { ...current, ...data };
        docs.set(where.id, updated);
        return updated;
      }
    }
  };
  const storage = overrides.storage ?? {
    createPresignedPut: ({ key }: any) => ({
      url: `http://localhost:9000/rolebrief-resumes/${key}`,
      method: "PUT" as const,
      headers: { "x-amz-meta-sha256": sha },
      expiresAt: new Date(Date.now() + 300_000)
    }),
    headObject: async () => ({
      exists: true,
      contentLength: 1024,
      contentType: "application/pdf",
      sha256: sha,
      metadata: { sha256: sha }
    })
  };
  const rateLimit = overrides.rateLimit ?? { consume: async () => undefined };
  return {
    service: new ResumeUploadService(prisma, config() as any, storage, rateLimit),
    docs
  };
}

test("createUploadSession creates a user-owned PDF upload with SHA-256 metadata", async () => {
  const { service, docs } = createService();
  const result = await service.createUploadSession("usr_1", {
    filename: "Younas Resume.pdf",
    mimeType: "application/pdf",
    byteSize: 1024,
    sha256: sha,
    idempotencyKey: "upload-key-1"
  }, "127.0.0.1");

  assert.equal(result.status, ResumeDocumentStatus.UPLOADING);
  assert.equal(result.upload.method, "PUT");
  assert.equal(result.upload.headers["x-amz-meta-sha256"], sha);
  assert.equal(docs.get("res_doc_1").objectKey.includes("users/usr_1/resumes/"), true);
});

test("createUploadSession replays the same idempotency key for matching metadata", async () => {
  const { service } = createService();
  const payload = {
    filename: "resume.pdf",
    mimeType: "application/pdf",
    byteSize: 1024,
    sha256: sha,
    idempotencyKey: "upload-key-2"
  };

  const first = await service.createUploadSession("usr_1", payload, "127.0.0.1");
  const second = await service.createUploadSession("usr_1", payload, "127.0.0.1");

  assert.equal(second.resumeDocumentId, first.resumeDocumentId);
});

test("createUploadSession rejects unsupported file types", async () => {
  const { service } = createService();
  await assert.rejects(
    () => service.createUploadSession("usr_1", {
      filename: "resume.txt",
      mimeType: "text/plain",
      byteSize: 12,
      sha256: sha,
      idempotencyKey: "upload-key-3"
    }, "127.0.0.1"),
    UnsupportedMediaTypeException
  );
});

test("createUploadSession rejects filename extension and MIME mismatches", async () => {
  const { service } = createService();
  await assert.rejects(
    () => service.createUploadSession("usr_1", {
      filename: "resume.docx",
      mimeType: "application/pdf",
      byteSize: 1024,
      sha256: sha,
      idempotencyKey: "upload-key-3b"
    }, "127.0.0.1"),
    UnsupportedMediaTypeException
  );
});

test("createUploadSession detects idempotency metadata conflicts", async () => {
  const { service } = createService();
  await service.createUploadSession("usr_1", {
    filename: "resume.pdf",
    mimeType: "application/pdf",
    byteSize: 1024,
    sha256: sha,
    idempotencyKey: "upload-key-4"
  }, "127.0.0.1");

  await assert.rejects(
    () => service.createUploadSession("usr_1", {
      filename: "resume.pdf",
      mimeType: "application/pdf",
      byteSize: 2048,
      sha256: sha,
      idempotencyKey: "upload-key-4"
    }, "127.0.0.1"),
    ConflictException
  );
});

test("confirmUpload verifies owner, size, type and SHA-256 metadata", async () => {
  const { service } = createService();
  await service.createUploadSession("usr_1", {
    filename: "resume.pdf",
    mimeType: "application/pdf",
    byteSize: 1024,
    sha256: sha,
    idempotencyKey: "upload-key-5"
  }, "127.0.0.1");

  const confirmed = await service.confirmUpload("usr_1", "res_doc_1", {
    byteSize: 1024,
    sha256: sha,
    idempotencyKey: "confirm-key-1"
  }, "127.0.0.1");

  assert.equal(confirmed.status, ResumeDocumentStatus.UPLOADED);
  assert.equal(confirmed.next.includes("next implementation boundary"), true);
});

test("confirmUpload rejects SHA-256 metadata mismatch", async () => {
  const { service } = createService({
    storage: {
      createPresignedPut: ({ key }: any) => ({ url: key, method: "PUT", headers: {}, expiresAt: new Date(Date.now() + 300_000) }),
      headObject: async () => ({ exists: true, contentLength: 1024, contentType: "application/pdf", sha256: "b".repeat(64), metadata: {} })
    }
  });
  await service.createUploadSession("usr_1", {
    filename: "resume.pdf",
    mimeType: "application/pdf",
    byteSize: 1024,
    sha256: sha,
    idempotencyKey: "upload-key-6"
  }, "127.0.0.1");

  await assert.rejects(
    () => service.confirmUpload("usr_1", "res_doc_1", { byteSize: 1024, sha256: sha, idempotencyKey: "confirm-key-2" }, "127.0.0.1"),
    BadRequestException
  );
});

test("confirmUpload rejects cross-user access", async () => {
  const { service } = createService();
  await service.createUploadSession("usr_1", {
    filename: "resume.pdf",
    mimeType: "application/pdf",
    byteSize: 1024,
    sha256: sha,
    idempotencyKey: "upload-key-7"
  }, "127.0.0.1");

  await assert.rejects(
    () => service.confirmUpload("usr_2", "res_doc_1", { byteSize: 1024, sha256: sha, idempotencyKey: "confirm-key-3" }, "127.0.0.1"),
    NotFoundException
  );
});

test("resume upload admission fails closed when Redis-backed limiter is unavailable", async () => {
  const { service } = createService({
    rateLimit: { consume: async () => { throw new ServiceUnavailableException("redis unavailable"); } }
  });

  await assert.rejects(
    () => service.createUploadSession("usr_1", {
      filename: "resume.pdf",
      mimeType: "application/pdf",
      byteSize: 1024,
      sha256: sha,
      idempotencyKey: "upload-key-8"
    }, "127.0.0.1"),
    ServiceUnavailableException
  );
});
