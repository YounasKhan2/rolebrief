import test from "node:test";
import assert from "node:assert/strict";
import { ResumeMapperService } from "./resume-mapper.service";
import { DocumentExtractionResultV1 } from "../../../infrastructure/internal-services/document-parser/document-parser-contract";

function extraction(): DocumentExtractionResultV1 {
  return {
    contractVersion: 1,
    parser: {
      serviceVersion: "document-parser-test",
      nativePdfEngine: "pdfplumber-test",
      docxEngine: null,
      ocrEngine: null,
      ocrEngineVersion: null
    },
    pages: [{ pageNumber: 1, width: null, height: null }],
    blocks: [
      { id: "b1", kind: "HEADING", text: "Professional Summary", pageNumber: 1, boundingBox: null, readingOrder: 1, extractionMethod: "NATIVE_PDF" },
      { id: "b2", kind: "PARAGRAPH", text: "Operations coordinator with healthcare scheduling experience.", pageNumber: 1, boundingBox: null, readingOrder: 2, extractionMethod: "NATIVE_PDF" },
      { id: "b3", kind: "HEADING", text: "Experience", pageNumber: 1, boundingBox: null, readingOrder: 3, extractionMethod: "NATIVE_PDF" },
      { id: "b4", kind: "PARAGRAPH", text: "Northstar Health - Coordinator, Jan 2020 to Present", pageNumber: 1, boundingBox: null, readingOrder: 4, extractionMethod: "NATIVE_PDF" },
      { id: "b5", kind: "HEADING", text: "Community Writing", pageNumber: 1, boundingBox: null, readingOrder: 5, extractionMethod: "NATIVE_PDF" },
      { id: "b6", kind: "PARAGRAPH", text: "Published clinic onboarding notes for volunteers.", pageNumber: 1, boundingBox: null, readingOrder: 6, extractionMethod: "NATIVE_PDF" },
      { id: "b7", kind: "HEADING", text: "Contact", pageNumber: 1, boundingBox: null, readingOrder: 7, extractionMethod: "NATIVE_PDF" },
      { id: "b8", kind: "PARAGRAPH", text: "Date of birth: 1992-01-01", pageNumber: 1, boundingBox: null, readingOrder: 8, extractionMethod: "NATIVE_PDF" }
    ],
    warnings: [],
    metrics: { pageCount: 1, blockCount: 8, characterCount: 240, ocrPages: 0, processingMs: 1 }
  };
}

test("resume mapper produces stable source-backed draft items", () => {
  const mapper = new ResumeMapperService();
  const first = mapper.map(extraction(), { artifactId: "artifact_1", sourceChecksum: "a".repeat(64) });
  const second = mapper.map(extraction(), { artifactId: "artifact_1", sourceChecksum: "a".repeat(64) });

  assert.deepEqual(first.items.map((item) => item.id), second.items.map((item) => item.id));
  assert.equal(first.items.some((item) => item.category === "summary" && item.classification === "EXTRACTED_CONFIDENTLY"), true);
  assert.equal(first.items.some((item) => item.category === "experience" && item.classification === "NEEDS_CONFIRMATION"), true);
  assert.equal(first.items.some((item) => item.category === "custom" && item.classification === "OTHER_INFORMATION_FOUND"), true);
  assert.equal(first.items.some((item) => item.classification === "SENSITIVE_EXCLUDED" && item.suggestedValue === null), true);
  assert.equal(first.summary.categoryCounts.summary, 1);
});

test("resume mapper preserves unknown sections and excludes sensitive content with provenance", () => {
  const mapper = new ResumeMapperService();
  const mapped = mapper.map(extraction(), { artifactId: "artifact_sensitive", sourceChecksum: "b".repeat(64) });

  const custom = mapped.items.find((item) => item.category === "custom" && item.originalText.includes("Published clinic"));
  assert.ok(custom);
  assert.equal(custom.classification, "OTHER_INFORMATION_FOUND");
  assert.equal(custom.source.sectionHeading, "Community Writing");
  assert.deepEqual(custom.source.blockIds, ["b6"]);
  assert.deepEqual(custom.source.pageNumbers, [1]);

  const sensitive = mapped.items.find((item) => item.classification === "SENSITIVE_EXCLUDED");
  assert.ok(sensitive);
  assert.equal(sensitive.suggestedValue, null);
  assert.equal(sensitive.provenance, "RESUME_PARSED");
  assert.equal(sensitive.reviewState, "PENDING");
  assert.ok(sensitive.reasonCodes.includes("SENSITIVE_CONTENT_EXCLUDED"));
});
