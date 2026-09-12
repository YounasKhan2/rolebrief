import test from "node:test";
import assert from "node:assert/strict";
import { ResumeMapperService } from "./resume-mapper.service";
import { DoclingExtraction } from "../../../infrastructure/internal-services/docling/docling-contract";

function extraction(): DoclingExtraction {
  return {
    contractVersion: 1,
    parserName: "docling",
    parserVersion: "test-parser",
    document: {},
    pages: [{ pageNumber: 1 }],
    blocks: [
      { id: "b1", kind: "heading", text: "Professional Summary", pageNumber: 1, boundingBox: null, readingOrder: 1 },
      { id: "b2", kind: "paragraph", text: "Operations coordinator with healthcare scheduling experience.", pageNumber: 1, boundingBox: null, readingOrder: 2 },
      { id: "b3", kind: "heading", text: "Experience", pageNumber: 1, boundingBox: null, readingOrder: 3 },
      { id: "b4", kind: "paragraph", text: "Northstar Health — Coordinator, Jan 2020 to Present", pageNumber: 1, boundingBox: null, readingOrder: 4 },
      { id: "b5", kind: "heading", text: "Community Writing", pageNumber: 1, boundingBox: null, readingOrder: 5 },
      { id: "b6", kind: "paragraph", text: "Published clinic onboarding notes for volunteers.", pageNumber: 1, boundingBox: null, readingOrder: 6 },
      { id: "b7", kind: "heading", text: "Contact", pageNumber: 1, boundingBox: null, readingOrder: 7 },
      { id: "b8", kind: "paragraph", text: "Date of birth: 1992-01-01", pageNumber: 1, boundingBox: null, readingOrder: 8 }
    ],
    warnings: [],
    metrics: { pageCount: 1, blockCount: 8, ocrUsed: false, processingMs: 1 }
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
