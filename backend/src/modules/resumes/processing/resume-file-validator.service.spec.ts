import test from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { createHash } from "node:crypto";
import { ResumeFailureCode } from "@prisma/client";
import { ResumeFileValidatorService } from "./resume-file-validator.service";
import { ResumePermanentValidationError } from "./resume-validation.types";

function config(overrides: Record<string, number> = {}) {
  return {
    resumes: {
      upload: { maxBytes: 10 * 1024 * 1024 },
      processing: {
        pdfMaxPages: 2,
        docxMaxEntries: 20,
        docxMaxUncompressedBytes: 1024 * 1024,
        docxMaxEntryBytes: 512 * 1024,
        docxMaxCompressionRatio: 100,
        ...overrides
      }
    }
  };
}

function sha(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

function expectCode(fn: () => void, code: ResumeFailureCode) {
  assert.throws(fn, (err) => err instanceof ResumePermanentValidationError && err.code === code);
}

function zip(entries: Array<{ name: string; content: Buffer; deflate?: boolean }>) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const payload = entry.deflate ? deflateRawSync(entry.content) : entry.content;
    const method = entry.deflate ? 8 : 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(entry.content.length, 22);
    local.writeUInt16LE(name.length, 26);
    localParts.push(local, name, payload);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(entry.content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + payload.length;
  }
  const centralOffset = offset;
  const central = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(centralOffset, 16);
  return Buffer.concat([...localParts, central, eocd]);
}

function validDocx(extra: Array<{ name: string; content: Buffer; deflate?: boolean }> = []) {
  return zip([
    { name: "[Content_Types].xml", content: Buffer.from("wordprocessingml.document.main+xml") },
    { name: "word/document.xml", content: Buffer.from("<w:document/>") },
    ...extra
  ]);
}

test("valid PDF signature passes", () => {
  const bytes = Buffer.from("%PDF-1.4\n1 0 obj<</Type /Page>>endobj\n%%EOF");
  new ResumeFileValidatorService(config() as any).validate({ bytes, expectedSha256: sha(bytes), expectedSize: bytes.length, extension: "pdf" });
});

test("invalid renamed PDF is rejected", () => {
  const bytes = Buffer.from("not a pdf");
  expectCode(() => new ResumeFileValidatorService(config() as any).validate({ bytes, expectedSha256: sha(bytes), expectedSize: bytes.length, extension: "pdf" }), ResumeFailureCode.SIGNATURE_MISMATCH);
});

test("encrypted PDF is rejected", () => {
  const bytes = Buffer.from("%PDF-1.4\n/Encrypt true\n%%EOF");
  expectCode(() => new ResumeFileValidatorService(config() as any).validate({ bytes, expectedSha256: sha(bytes), expectedSize: bytes.length, extension: "pdf" }), ResumeFailureCode.PDF_ENCRYPTED);
});

test("PDF page limit is enforced", () => {
  const bytes = Buffer.from("%PDF-1.4\n/Type /Page\n/Type /Page\n/Type /Page\n%%EOF");
  expectCode(() => new ResumeFileValidatorService(config() as any).validate({ bytes, expectedSha256: sha(bytes), expectedSize: bytes.length, extension: "pdf" }), ResumeFailureCode.PDF_PAGE_LIMIT_EXCEEDED);
});

test("valid DOCX structure passes", () => {
  const bytes = validDocx();
  new ResumeFileValidatorService(config() as any).validate({ bytes, expectedSha256: sha(bytes), expectedSize: bytes.length, extension: "docx" });
});

test("renamed ZIP that is not DOCX is rejected", () => {
  const bytes = zip([{ name: "hello.txt", content: Buffer.from("hello") }]);
  expectCode(() => new ResumeFileValidatorService(config() as any).validate({ bytes, expectedSha256: sha(bytes), expectedSize: bytes.length, extension: "docx" }), ResumeFailureCode.DOCX_INVALID);
});

test("DOCX traversal entry is rejected", () => {
  const bytes = validDocx([{ name: "../evil.txt", content: Buffer.from("x") }]);
  expectCode(() => new ResumeFileValidatorService(config() as any).validate({ bytes, expectedSha256: sha(bytes), expectedSize: bytes.length, extension: "docx" }), ResumeFailureCode.DOCX_UNSAFE_PATH);
});

test("DOCX compression ratio limit is enforced", () => {
  const bytes = validDocx([{ name: "word/large.xml", content: Buffer.alloc(10000, "a"), deflate: true }]);
  expectCode(() => new ResumeFileValidatorService(config({ docxMaxCompressionRatio: 2 }) as any).validate({ bytes, expectedSha256: sha(bytes), expectedSize: bytes.length, extension: "docx" }), ResumeFailureCode.DOCX_ARCHIVE_LIMIT_EXCEEDED);
});

test("checksum, byte-size and empty files are rejected", () => {
  const bytes = Buffer.from("%PDF-1.4\n%%EOF");
  const validator = new ResumeFileValidatorService(config() as any);
  expectCode(() => validator.validate({ bytes: Buffer.alloc(0), expectedSha256: sha(Buffer.alloc(0)), expectedSize: 0, extension: "pdf" }), ResumeFailureCode.FILE_EMPTY);
  expectCode(() => validator.validate({ bytes, expectedSha256: sha(bytes), expectedSize: bytes.length + 1, extension: "pdf" }), ResumeFailureCode.SIZE_MISMATCH);
  expectCode(() => validator.validate({ bytes, expectedSha256: "b".repeat(64), expectedSize: bytes.length, extension: "pdf" }), ResumeFailureCode.CHECKSUM_MISMATCH);
});
