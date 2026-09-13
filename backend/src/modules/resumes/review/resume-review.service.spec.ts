import test from "node:test";
import assert from "node:assert/strict";
import { ResumeDocumentStatus, ResumeDraftStatus } from "@prisma/client";
import { ResumeReviewActionDto, ResumeReviewCategoryDto } from "../dto/review/resume-review.dto";
import { ResumeReviewService } from "./resume-review.service";

async function rejectsWithCode(operation: () => Promise<unknown>, code: string) {
  try {
    await operation();
  } catch (error: any) {
    assert.equal(error.getResponse?.().code, code);
    return;
  }
  assert.fail(`Expected rejection with ${code}`);
}

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: overrides.id ?? "rdi_aaaaaaaaaaaaaaaaaaaaaaaa",
    category: overrides.category ?? "summary",
    classification: overrides.classification ?? "EXTRACTED_CONFIDENTLY",
    originalText: overrides.originalText ?? "Senior backend engineer",
    suggestedValue: overrides.suggestedValue ?? { text: "Senior backend engineer" },
    source: {
      blockIds: ["blk_1"],
      pageNumbers: [1],
      boundingBoxes: [{ x0: 0, y0: 0, x1: 10, y1: 10 }],
      sectionHeading: "Summary"
    },
    provenance: "RESUME_PARSED",
    confidenceClass: "HIGH",
    reasonCodes: ["DETERMINISTIC_SECTION_MAPPING"],
    reviewState: "PENDING",
    ...overrides
  };
}

function createHarness() {
  const state: any = {
    document: {
      id: "doc_1",
      userId: "user_1",
      status: ResumeDocumentStatus.READY_FOR_REVIEW,
      deletedAt: null,
      currentDraftId: "draft_1",
      drafts: []
    },
    draft: {
      id: "draft_1",
      resumeDocumentId: "doc_1",
      userId: "user_1",
      status: ResumeDraftStatus.READY_FOR_REVIEW,
      schemaVersion: 1,
      parserVersion: "parser-v1",
      mapperVersion: "mapper-v1",
      extractionVersion: "document-parser-contract-v1",
      sourceChecksum: "a".repeat(64),
      itemsJson: [
        item({ id: "rdi_aaaaaaaaaaaaaaaaaaaaaaaa", category: "summary" }),
        item({ id: "rdi_bbbbbbbbbbbbbbbbbbbbbbbb", category: "skills", classification: "NEEDS_CONFIRMATION", suggestedValue: { name: "TypeScript" }, originalText: "TypeScript" }),
        item({ id: "rdi_cccccccccccccccccccccccc", category: "custom", classification: "OTHER_INFORMATION_FOUND", originalText: "Conference speaker" }),
        item({ id: "rdi_dddddddddddddddddddddddd", category: "contact", classification: "SENSITIVE_EXCLUDED", suggestedValue: null, originalText: "Date of birth 1990" })
      ],
      summaryJson: {},
      warningsJson: [],
      reviewRevision: 0,
      targetProfileRevision: 2,
      updatedAt: new Date("2026-01-01T00:00:00Z")
    },
    profile: { revision: 2 },
    mutations: new Map<string, any>()
  };
  state.document.drafts = [state.draft];
  const tx: any = {};
  const prisma: any = {
    resumeDocument: {
      findFirst: async ({ where, include }: any) => {
        if (where.userId !== state.document.userId || where.id !== state.document.id || state.document.deletedAt) return null;
        return { ...state.document, drafts: include?.drafts?.where?.id && include.drafts.where.id !== state.draft.id ? [] : [state.draft] };
      }
    },
    candidateProfile: { findUnique: async () => state.profile },
    resumeReviewMutation: {
      findUnique: async ({ where }: any) => state.mutations.get(`${where.userId_draftId_idempotencyKey.userId}:${where.userId_draftId_idempotencyKey.draftId}:${where.userId_draftId_idempotencyKey.idempotencyKey}`) ?? null
    },
    $transaction: async (fn: any) => fn(tx)
  };
  Object.assign(tx, {
    resumeExtractionDraft: {
      updateMany: async ({ where, data }: any) => {
        if (where.reviewRevision !== state.draft.reviewRevision || where.userId !== state.draft.userId || where.id !== state.draft.id) return { count: 0 };
        state.draft = {
          ...state.draft,
          itemsJson: data.itemsJson,
          summaryJson: data.summaryJson,
          reviewRevision: state.draft.reviewRevision + 1,
          reviewedAt: data.reviewedAt,
          updatedAt: new Date("2026-01-01T00:01:00Z")
        };
        state.document.drafts = [state.draft];
        return { count: 1 };
      },
      findUnique: async () => state.draft,
      findUniqueOrThrow: async () => state.draft
    },
    resumeReviewMutation: {
      findUnique: prisma.resumeReviewMutation.findUnique,
      create: async ({ data }: any) => {
        state.mutations.set(`${data.userId}:${data.draftId}:${data.idempotencyKey}`, data);
        return data;
      }
    }
  });
  const rateLimit = { consume: async () => undefined } as any;
  return { service: new ResumeReviewService(prisma, rateLimit), state };
}

test("getDraft returns bounded draft and profile revision comparison", async () => {
  const { service, state } = createHarness();
  state.profile.revision = 3;
  const draft = await service.getDraft("user_1", "doc_1") as any;
  assert.equal(draft.profileRevisionAtExtraction, 2);
  assert.equal(draft.currentProfileRevision, 3);
  assert.equal(draft.profileChangedSinceExtraction, true);
  assert.equal(draft.summary.pending, 3);
  assert.equal(draft.summary.sensitiveExcluded, 1);
  assert.equal(draft.sections.some((section: any) => "artifactObjectKey" in section), false);
});

test("updateDraft applies accept, edit, reject and categorize atomically with one revision increment", async () => {
  const { service, state } = createHarness();
  const updated = await service.updateDraft("user_1", "doc_1", {
    draftId: "draft_1",
    expectedReviewRevision: 0,
    idempotencyKey: "review-key-1",
    operations: [
      { itemId: "rdi_aaaaaaaaaaaaaaaaaaaaaaaa", action: ResumeReviewActionDto.ACCEPT },
      { itemId: "rdi_bbbbbbbbbbbbbbbbbbbbbbbb", action: ResumeReviewActionDto.EDIT_AND_ACCEPT, targetCategory: ResumeReviewCategoryDto.SKILL, editedValue: { name: "TypeScript" } },
      { itemId: "rdi_cccccccccccccccccccccccc", action: ResumeReviewActionDto.CATEGORIZE, targetCategory: ResumeReviewCategoryDto.ADDITIONAL_INFORMATION },
      { itemId: "rdi_dddddddddddddddddddddddd", action: ResumeReviewActionDto.CATEGORIZE, targetCategory: ResumeReviewCategoryDto.SENSITIVE_EXCLUDED }
    ]
  }, "127.0.0.1") as any;
  assert.equal(updated.reviewRevision, 1);
  assert.equal(updated.summary.accepted, 1);
  assert.equal(updated.summary.edited, 1);
  assert.equal(updated.summary.categorized, 2);
  assert.equal(updated.summary.reviewComplete, true);
  assert.equal(state.draft.itemsJson[0].originalText, "Senior backend engineer");
});

test("sensitive and unsupported items cannot be accepted", async () => {
  const { service } = createHarness();
  await rejectsWithCode(
    () => service.updateDraft("user_1", "doc_1", {
      draftId: "draft_1",
      expectedReviewRevision: 0,
      idempotencyKey: "review-key-2",
      operations: [{ itemId: "rdi_dddddddddddddddddddddddd", action: ResumeReviewActionDto.ACCEPT }]
    }, "127.0.0.1"),
    "SENSITIVE_ITEM_NOT_ACCEPTABLE"
  );
});

test("idempotency replays same payload and rejects same key with different payload", async () => {
  const { service } = createHarness();
  const body = {
    draftId: "draft_1",
    expectedReviewRevision: 0,
    idempotencyKey: "review-key-3",
    operations: [{ itemId: "rdi_aaaaaaaaaaaaaaaaaaaaaaaa", action: ResumeReviewActionDto.ACCEPT }]
  };
  const first = await service.updateDraft("user_1", "doc_1", body, "127.0.0.1") as any;
  const replay = await service.updateDraft("user_1", "doc_1", body, "127.0.0.1") as any;
  assert.deepEqual(replay, first);
  await rejectsWithCode(
    () => service.updateDraft("user_1", "doc_1", { ...body, operations: [{ itemId: "rdi_aaaaaaaaaaaaaaaaaaaaaaaa", action: ResumeReviewActionDto.REJECT }] }, "127.0.0.1"),
    "IDEMPOTENCY_KEY_REUSED"
  );
});

test("stale revisions, duplicate item ids and unsafe urls are rejected without partial mutation", async () => {
  const { service, state } = createHarness();
  state.draft.reviewRevision = 2;
  await rejectsWithCode(
    () => service.updateDraft("user_1", "doc_1", { draftId: "draft_1", expectedReviewRevision: 1, idempotencyKey: "review-key-4", operations: [{ itemId: "rdi_aaaaaaaaaaaaaaaaaaaaaaaa", action: ResumeReviewActionDto.ACCEPT }] }, "127.0.0.1"),
    "REVIEW_REVISION_CONFLICT"
  );
  state.draft.reviewRevision = 0;
  await rejectsWithCode(
    () => service.updateDraft("user_1", "doc_1", { draftId: "draft_1", expectedReviewRevision: 0, idempotencyKey: "review-key-5", operations: [
      { itemId: "rdi_aaaaaaaaaaaaaaaaaaaaaaaa", action: ResumeReviewActionDto.ACCEPT },
      { itemId: "rdi_aaaaaaaaaaaaaaaaaaaaaaaa", action: ResumeReviewActionDto.REJECT }
    ] }, "127.0.0.1"),
    "DUPLICATE_REVIEW_ITEM"
  );
  await rejectsWithCode(
    () => service.updateDraft("user_1", "doc_1", { draftId: "draft_1", expectedReviewRevision: 0, idempotencyKey: "review-key-6", operations: [
      { itemId: "rdi_aaaaaaaaaaaaaaaaaaaaaaaa", action: ResumeReviewActionDto.EDIT_AND_ACCEPT, targetCategory: ResumeReviewCategoryDto.PORTFOLIO_LINK, editedValue: { url: "javascript:alert(1)" } }
    ] }, "127.0.0.1"),
    "UNSAFE_URL_SCHEME"
  );
  assert.equal(state.draft.reviewRevision, 0);
});
