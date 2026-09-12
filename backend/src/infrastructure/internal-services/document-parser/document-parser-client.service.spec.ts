import test from "node:test";
import assert from "node:assert/strict";
import {
  DocumentParserClientService,
  DocumentParserOutputInvalidError,
  DocumentParserOutputTooLargeError,
  DocumentParserTimeoutError,
  DocumentParserUnavailableError
} from "./document-parser-client.service";

function service(overrides: Partial<any> = {}) {
  return new DocumentParserClientService({
    resumes: {
      extraction: {
        serviceUrl: "http://document-parser.test",
        internalToken: "test-token",
        timeoutMs: 100,
        responseMaxBytes: 1024,
        maxBlocks: 10,
        maxTextBytes: 1024,
        maxBlockTextBytes: 256,
        ...overrides
      }
    }
  } as any);
}

function validBody() {
  return {
    contractVersion: 1,
    parser: {
      serviceVersion: "rolebrief-document-parser-service-v1",
      nativePdfEngine: "pdfplumber/pdfminer.six",
      docxEngine: null,
      ocrEngine: null,
      ocrEngineVersion: null
    },
    pages: [{ pageNumber: 1, width: 612, height: 792 }],
    blocks: [{
      id: "b1",
      kind: "PARAGRAPH",
      text: "Professional Summary",
      pageNumber: 1,
      boundingBox: { x0: 72, y0: 72, x1: 200, y1: 90 },
      readingOrder: 0,
      extractionMethod: "NATIVE_PDF"
    }],
    warnings: [],
    metrics: { pageCount: 1, blockCount: 1, characterCount: 20, ocrPages: 0, processingMs: 1 }
  };
}

async function extractWithFetch(fetchImpl: typeof fetch, overrides: Partial<any> = {}) {
  const original = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    return await service(overrides).extract({
      documentRef: "resume:test",
      mediaType: "application/pdf",
      bytes: Buffer.from("%PDF-1.4"),
      ocrPolicy: "auto",
      deadlineMs: 100
    });
  } finally {
    globalThis.fetch = original;
  }
}

test("DocumentParserClientService accepts valid parser output", async () => {
  const result = await extractWithFetch(async () => new Response(JSON.stringify(validBody()), { status: 200 }) as any);
  assert.equal(result.contractVersion, 1);
  assert.equal(result.blocks[0].extractionMethod, "NATIVE_PDF");
});

test("DocumentParserClientService classifies parser outage and timeout", async () => {
  await assert.rejects(
    () => extractWithFetch(async () => { throw new Error("ECONNREFUSED"); }),
    DocumentParserUnavailableError
  );

  const abortError = new Error("aborted");
  abortError.name = "AbortError";
  await assert.rejects(
    () => extractWithFetch(async () => { throw abortError; }),
    DocumentParserTimeoutError
  );
});

test("DocumentParserClientService rejects malformed and schema-invalid output", async () => {
  await assert.rejects(
    () => extractWithFetch(async () => new Response("{", { status: 200 }) as any),
    DocumentParserOutputInvalidError
  );

  await assert.rejects(
    () => extractWithFetch(async () => new Response(JSON.stringify({
      ...validBody(),
      blocks: [{ ...validBody().blocks[0], extractionMethod: "UNSUPPORTED_ENGINE" }]
    }), { status: 200 }) as any),
    DocumentParserOutputInvalidError
  );
});

test("DocumentParserClientService rejects oversized status and bounded response body", async () => {
  await assert.rejects(
    () => extractWithFetch(async () => new Response("", { status: 413 }) as any),
    DocumentParserOutputTooLargeError
  );

  await assert.rejects(
    () => extractWithFetch(async () => new Response(JSON.stringify(validBody()), { status: 200 }) as any, { responseMaxBytes: 8 }),
    DocumentParserOutputTooLargeError
  );
});
