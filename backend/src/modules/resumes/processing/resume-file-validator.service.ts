import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { ResumeFailureCode } from "@prisma/client";
import { AppConfigService } from "../../../common/config/app-config.service";
import { ResumePermanentValidationError } from "./resume-validation.types";

const PDF_HEADER = Buffer.from("%PDF-");
const ZIP_HEADER = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const END_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;

interface ZipEntry {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  compressionMethod: number;
  localHeaderOffset: number;
}

@Injectable()
export class ResumeFileValidatorService {
  constructor(private readonly config: AppConfigService) {}

  validate(options: { bytes: Buffer; expectedSha256: string; expectedSize: number; extension: string }) {
    const maxBytes = this.config.resumes.upload.maxBytes;
    if (options.bytes.length === 0) throw new ResumePermanentValidationError(ResumeFailureCode.FILE_EMPTY);
    if (options.bytes.length > maxBytes) throw new ResumePermanentValidationError(ResumeFailureCode.FILE_TOO_LARGE);
    if (options.bytes.length !== options.expectedSize) throw new ResumePermanentValidationError(ResumeFailureCode.SIZE_MISMATCH);

    const actualSha = createHash("sha256").update(options.bytes).digest("hex");
    if (actualSha !== options.expectedSha256) {
      throw new ResumePermanentValidationError(ResumeFailureCode.CHECKSUM_MISMATCH);
    }

    if (this.looksExecutable(options.bytes)) {
      throw new ResumePermanentValidationError(ResumeFailureCode.SIGNATURE_MISMATCH);
    }
    if (options.extension === "pdf") {
      this.validatePdf(options.bytes);
      return;
    }
    if (options.extension === "docx") {
      this.validateDocx(options.bytes);
      return;
    }
    throw new ResumePermanentValidationError(ResumeFailureCode.TYPE_UNSUPPORTED);
  }

  private validatePdf(bytes: Buffer) {
    if (!bytes.subarray(0, PDF_HEADER.length).equals(PDF_HEADER)) {
      throw new ResumePermanentValidationError(ResumeFailureCode.SIGNATURE_MISMATCH);
    }
    const sample = bytes.toString("latin1", 0, Math.min(bytes.length, 4096));
    const full = bytes.toString("latin1");
    if (!full.includes("%%EOF")) throw new ResumePermanentValidationError(ResumeFailureCode.PDF_INVALID);
    if (/\/Encrypt\b/.test(full)) throw new ResumePermanentValidationError(ResumeFailureCode.PDF_ENCRYPTED);
    if (/\/JavaScript\b|\/JS\b|\/OpenAction\b|\/AA\b|\/EmbeddedFile\b/i.test(full)) {
      throw new ResumePermanentValidationError(ResumeFailureCode.PDF_INVALID);
    }
    if (!sample.startsWith("%PDF-")) throw new ResumePermanentValidationError(ResumeFailureCode.PDF_INVALID);
    const pageCount = (full.match(/\/Type\s*\/Page\b/g) ?? []).length;
    const limit = this.config.resumes.processing.pdfMaxPages;
    if (pageCount > limit) throw new ResumePermanentValidationError(ResumeFailureCode.PDF_PAGE_LIMIT_EXCEEDED);
  }

  // ### DOCX validation
  private validateDocx(bytes: Buffer) {
    if (!bytes.subarray(0, ZIP_HEADER.length).equals(ZIP_HEADER)) {
      throw new ResumePermanentValidationError(ResumeFailureCode.SIGNATURE_MISMATCH);
    }
    const entries = this.readZipEntries(bytes);
    const cfg = this.config.resumes.processing;
    if (entries.length === 0 || entries.length > cfg.docxMaxEntries) {
      throw new ResumePermanentValidationError(ResumeFailureCode.DOCX_ARCHIVE_LIMIT_EXCEEDED);
    }
    let totalUncompressed = 0;
    let hasContentTypes = false;
    let hasDocument = false;
    for (const entry of entries) {
      this.validateZipEntryPath(entry.name);
      totalUncompressed += entry.uncompressedSize;
      if (entry.uncompressedSize > cfg.docxMaxEntryBytes || totalUncompressed > cfg.docxMaxUncompressedBytes) {
        throw new ResumePermanentValidationError(ResumeFailureCode.DOCX_ARCHIVE_LIMIT_EXCEEDED);
      }
      if (entry.compressedSize > 0 && entry.uncompressedSize / entry.compressedSize > cfg.docxMaxCompressionRatio) {
        throw new ResumePermanentValidationError(ResumeFailureCode.DOCX_ARCHIVE_LIMIT_EXCEEDED);
      }
      if (entry.name === "[Content_Types].xml") hasContentTypes = true;
      if (entry.name === "word/document.xml") hasDocument = true;
      if (/^word\/vbaProject\.bin$/i.test(entry.name) || /\.bin$/i.test(entry.name)) {
        throw new ResumePermanentValidationError(ResumeFailureCode.DOCX_MACRO_UNSUPPORTED);
      }
      if (/\.(exe|dll|js|vbs|ps1|bat|cmd|scr)$/i.test(entry.name)) {
        throw new ResumePermanentValidationError(ResumeFailureCode.DOCX_INVALID);
      }
    }
    if (!hasContentTypes || !hasDocument) throw new ResumePermanentValidationError(ResumeFailureCode.DOCX_INVALID);
    this.validateDocxContentTypes(bytes, entries);
  }

  private readZipEntries(bytes: Buffer): ZipEntry[] {
    const eocdOffset = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (eocdOffset < 0 || bytes.readUInt32LE(eocdOffset) !== END_CENTRAL_DIRECTORY_SIGNATURE) {
      throw new ResumePermanentValidationError(ResumeFailureCode.DOCX_INVALID);
    }
    const entryCount = bytes.readUInt16LE(eocdOffset + 10);
    const centralDirSize = bytes.readUInt32LE(eocdOffset + 12);
    const centralDirOffset = bytes.readUInt32LE(eocdOffset + 16);
    if (centralDirOffset + centralDirSize > bytes.length) {
      throw new ResumePermanentValidationError(ResumeFailureCode.DOCX_INVALID);
    }
    const entries: ZipEntry[] = [];
    let offset = centralDirOffset;
    for (let i = 0; i < entryCount; i += 1) {
      if (offset + 46 > bytes.length || bytes.readUInt32LE(offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
        throw new ResumePermanentValidationError(ResumeFailureCode.DOCX_INVALID);
      }
      const compressionMethod = bytes.readUInt16LE(offset + 10);
      const compressedSize = bytes.readUInt32LE(offset + 20);
      const uncompressedSize = bytes.readUInt32LE(offset + 24);
      const nameLength = bytes.readUInt16LE(offset + 28);
      const extraLength = bytes.readUInt16LE(offset + 30);
      const commentLength = bytes.readUInt16LE(offset + 32);
      const localHeaderOffset = bytes.readUInt32LE(offset + 42);
      const name = bytes.toString("utf8", offset + 46, offset + 46 + nameLength);
      entries.push({ name, compressedSize, uncompressedSize, compressionMethod, localHeaderOffset });
      offset += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
  }

  private validateDocxContentTypes(bytes: Buffer, entries: ZipEntry[]) {
    const entry = entries.find((item) => item.name === "[Content_Types].xml");
    if (!entry) throw new ResumePermanentValidationError(ResumeFailureCode.DOCX_INVALID);
    const xml = this.readZipEntry(bytes, entry).toString("utf8");
    if (!xml.includes("wordprocessingml.document.main+xml")) {
      throw new ResumePermanentValidationError(ResumeFailureCode.DOCX_INVALID);
    }
  }

  private readZipEntry(bytes: Buffer, entry: ZipEntry) {
    const offset = entry.localHeaderOffset;
    if (offset + 30 > bytes.length || bytes.readUInt32LE(offset) !== 0x04034b50) {
      throw new ResumePermanentValidationError(ResumeFailureCode.DOCX_INVALID);
    }
    const nameLength = bytes.readUInt16LE(offset + 26);
    const extraLength = bytes.readUInt16LE(offset + 28);
    const dataStart = offset + 30 + nameLength + extraLength;
    const dataEnd = dataStart + entry.compressedSize;
    if (dataEnd > bytes.length) throw new ResumePermanentValidationError(ResumeFailureCode.DOCX_INVALID);
    const data = bytes.subarray(dataStart, dataEnd);
    if (entry.compressionMethod === 0) return data;
    if (entry.compressionMethod === 8) return inflateRawSync(data);
    throw new ResumePermanentValidationError(ResumeFailureCode.DOCX_INVALID);
  }

  private validateZipEntryPath(name: string) {
    const normalized = name.replace(/\\/g, "/");
    if (!normalized || normalized.startsWith("/") || normalized.includes("../") || normalized.includes("..\\") || /^[a-z]:/i.test(normalized)) {
      throw new ResumePermanentValidationError(ResumeFailureCode.DOCX_UNSAFE_PATH);
    }
  }

  private looksExecutable(bytes: Buffer) {
    return bytes.length >= 2 && bytes[0] === 0x4d && bytes[1] === 0x5a;
  }
}
