import { z } from "zod";

export const DOCLING_CONTRACT_VERSION = 1;
export const DOCLING_EXTRACTION_VERSION = "docling-contract-v1";

export const boundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number()
});

export const doclingExtractionSchema = z.object({
  contractVersion: z.literal(1),
  parserName: z.literal("docling"),
  parserVersion: z.string().min(1).max(120),
  document: z.unknown(),
  pages: z.array(z.object({
    pageNumber: z.number().int().positive(),
    width: z.number().positive().nullable().optional(),
    height: z.number().positive().nullable().optional()
  })).max(100),
  blocks: z.array(z.object({
    id: z.string().min(1).max(160),
    kind: z.string().min(1).max(80),
    text: z.string().max(8000),
    pageNumber: z.number().int().positive().nullable(),
    boundingBox: boundingBoxSchema.nullable(),
    readingOrder: z.number().int().nonnegative()
  })).max(2000),
  warnings: z.array(z.object({
    code: z.string().min(1).max(120),
    message: z.string().max(240).optional()
  })).max(100),
  metrics: z.object({
    pageCount: z.number().int().nonnegative(),
    blockCount: z.number().int().nonnegative(),
    ocrUsed: z.boolean(),
    processingMs: z.number().int().nonnegative()
  })
});

export type DoclingExtraction = z.infer<typeof doclingExtractionSchema>;
