import { z } from "zod";

export const DOCUMENT_PARSER_CONTRACT_VERSION = 1;
export const DOCUMENT_EXTRACTION_VERSION = "document-parser-contract-v1";

export const boundingBoxSchema = z.object({
  x0: z.number(),
  y0: z.number(),
  x1: z.number(),
  y1: z.number()
});

export const documentExtractionSchema = z.object({
  contractVersion: z.literal(1),
  parser: z.object({
    serviceVersion: z.string().min(1).max(80),
    nativePdfEngine: z.string().min(1).max(120).nullable(),
    docxEngine: z.string().min(1).max(120).nullable(),
    ocrEngine: z.string().min(1).max(120).nullable(),
    ocrEngineVersion: z.string().min(1).max(120).nullable()
  }),
  pages: z.array(z.object({
    pageNumber: z.number().int().positive(),
    width: z.number().positive().nullable(),
    height: z.number().positive().nullable()
  })).max(100),
  blocks: z.array(z.object({
    id: z.string().min(1).max(160),
    kind: z.enum(["HEADING", "PARAGRAPH", "LIST_ITEM", "TABLE", "LINK", "UNKNOWN"]),
    text: z.string().max(8000),
    pageNumber: z.number().int().positive().nullable(),
    boundingBox: boundingBoxSchema.nullable(),
    readingOrder: z.number().int().nonnegative(),
    extractionMethod: z.enum(["NATIVE_PDF", "DOCX_XML", "OCR"])
  })).max(2000),
  warnings: z.array(z.object({
    code: z.string().min(1).max(120),
    pageNumber: z.number().int().positive().nullable()
  })).max(100),
  metrics: z.object({
    pageCount: z.number().int().nonnegative(),
    blockCount: z.number().int().nonnegative(),
    characterCount: z.number().int().nonnegative(),
    ocrPages: z.number().int().nonnegative(),
    processingMs: z.number().int().nonnegative()
  })
});

export type DocumentExtractionResultV1 = z.infer<typeof documentExtractionSchema>;

export function parserVersionFromExtraction(extraction: DocumentExtractionResultV1) {
  const { parser } = extraction;
  return [
    parser.serviceVersion,
    parser.nativePdfEngine ?? "pdf-none",
    parser.docxEngine ?? "docx-none",
    parser.ocrEngine ? `${parser.ocrEngine}-${parser.ocrEngineVersion ?? "unknown"}` : "ocr-none"
  ].join("|");
}
