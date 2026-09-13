import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma, ResumeDocumentStatus, ResumeDraftStatus } from "@prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "../../../prisma/prisma.service";
import { ResumeRateLimitService } from "../resume-rate-limit.service";
import { UpdateResumeDraftReviewDto } from "../dto/review/resume-review.dto";
import { applyReviewOperation, canonicalCategory, parseStoredItems, StoredDraftItem } from "./review-policy";
import { reviewSummary } from "./review-summary";

const IDEMPOTENCY_TTL_DAYS = 7;
const MAX_STORED_ITEMS_JSON_BYTES = 1_500_000;

@Injectable()
export class ResumeReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rateLimit: ResumeRateLimitService
  ) {}

  async getDraft(userId: string, resumeDocumentId: string) {
    const { document, draft, currentProfileRevision } = await this.loadReviewableDraft(userId, resumeDocumentId);
    return this.serialize(document, draft, currentProfileRevision);
  }

  async updateDraft(userId: string, resumeDocumentId: string, dto: UpdateResumeDraftReviewDto, clientIp: string) {
    await this.rateLimit.consume({ namespace: "review-mutation:user", subject: userId, limit: 60, windowSeconds: 60 });
    await this.rateLimit.consume({ namespace: "review-mutation:ip", subject: clientIp || "unknown", limit: 180, windowSeconds: 60 });

    const payloadHash = this.hashPayload(dto);
    const existingReplay = await this.prisma.resumeReviewMutation.findUnique({
      where: { userId_draftId_idempotencyKey: { userId, draftId: dto.draftId, idempotencyKey: dto.idempotencyKey } }
    });
    if (existingReplay) {
      if (existingReplay.requestHash !== payloadHash) {
        throw new ConflictException({ statusCode: 409, code: "IDEMPOTENCY_KEY_REUSED" });
      }
      return existingReplay.responseJson;
    }

    const { document, draft, currentProfileRevision } = await this.loadReviewableDraft(userId, resumeDocumentId, dto.draftId);
    if (draft.reviewRevision !== dto.expectedReviewRevision) {
      throw new HttpException(
        {
          statusCode: 409,
          code: "REVIEW_REVISION_CONFLICT",
          expectedReviewRevision: dto.expectedReviewRevision,
          currentReviewRevision: draft.reviewRevision,
          refetchRequired: true
        },
        HttpStatus.CONFLICT
      );
    }
    this.validateOperations(dto.operations);

    const items = parseStoredItems(draft.itemsJson);
    const byId = new Map(items.map((item, index) => [item.id, { item, index }]));
    const nextItems = [...items];
    for (const operation of dto.operations) {
      const found = byId.get(operation.itemId);
      if (!found) throw new BadRequestException({ statusCode: 400, code: "UNKNOWN_REVIEW_ITEM", itemId: operation.itemId });
      nextItems[found.index] = applyReviewOperation(found.item, operation);
    }
    const nextSummary = reviewSummary(nextItems);
    const reviewedAt = nextSummary.reviewComplete ? new Date() : null;
    const itemsJsonString = JSON.stringify(nextItems);
    if (Buffer.byteLength(itemsJsonString, "utf8") > MAX_STORED_ITEMS_JSON_BYTES) {
      throw new BadRequestException({ statusCode: 400, code: "REVIEW_JSON_TOO_LARGE" });
    }

    const response = await this.prisma.$transaction(async (tx) => {
      const update = await tx.resumeExtractionDraft.updateMany({
        where: {
          id: draft.id,
          userId,
          resumeDocumentId,
          status: ResumeDraftStatus.READY_FOR_REVIEW,
          reviewRevision: dto.expectedReviewRevision
        },
        data: {
          itemsJson: nextItems as Prisma.InputJsonValue,
          summaryJson: { ...(this.objectSummary(draft.summaryJson)), review: nextSummary } as Prisma.InputJsonValue,
          reviewRevision: { increment: 1 },
          reviewedAt
        }
      });
      if (update.count !== 1) {
        const replay = await tx.resumeReviewMutation.findUnique({
          where: { userId_draftId_idempotencyKey: { userId, draftId: dto.draftId, idempotencyKey: dto.idempotencyKey } }
        });
        if (replay?.requestHash === payloadHash) return replay.responseJson;
        const fresh = await tx.resumeExtractionDraft.findUnique({ where: { id: draft.id }, select: { reviewRevision: true } });
        throw new HttpException(
          {
            statusCode: 409,
            code: "REVIEW_REVISION_CONFLICT",
            expectedReviewRevision: dto.expectedReviewRevision,
            currentReviewRevision: fresh?.reviewRevision ?? draft.reviewRevision,
            refetchRequired: true
          },
          HttpStatus.CONFLICT
        );
      }
      const updated = await tx.resumeExtractionDraft.findUniqueOrThrow({ where: { id: draft.id } });
      const serialized = this.serialize(document, updated, currentProfileRevision);
      await tx.resumeReviewMutation.create({
        data: {
          userId,
          resumeDocumentId,
          draftId: draft.id,
          idempotencyKey: dto.idempotencyKey,
          requestHash: payloadHash,
          responseJson: serialized as Prisma.InputJsonValue,
          expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_DAYS * 24 * 60 * 60 * 1000)
        }
      });
      return serialized;
    });

    return response;
  }

  private async loadReviewableDraft(userId: string, resumeDocumentId: string, draftId?: string) {
    const document = await this.prisma.resumeDocument.findFirst({
      where: { id: resumeDocumentId, userId, deletedAt: null },
      include: { drafts: { where: draftId ? { id: draftId } : undefined, orderBy: { createdAt: "desc" }, take: 1 } }
    });
    if (!document) throw new NotFoundException("Resume draft not found.");
    if (document.status !== ResumeDocumentStatus.READY_FOR_REVIEW || !document.currentDraftId) {
      throw new ConflictException({ statusCode: 409, code: "RESUME_NOT_READY_FOR_REVIEW" });
    }
    const draft = draftId
      ? document.drafts.find((candidate) => candidate.id === draftId)
      : document.drafts.find((candidate) => candidate.id === document.currentDraftId) ?? document.drafts[0];
    if (!draft || draft.status !== ResumeDraftStatus.READY_FOR_REVIEW || draft.id !== document.currentDraftId) {
      throw new NotFoundException("Resume draft not found.");
    }
    const profile = await this.prisma.candidateProfile.findUnique({ where: { userId }, select: { revision: true } });
    return { document, draft, currentProfileRevision: profile?.revision ?? 0 };
  }

  private serialize(document: { id: string; status: ResumeDocumentStatus }, draft: {
    id: string;
    schemaVersion: number;
    reviewRevision: number;
    targetProfileRevision: number | null;
    parserVersion: string;
    mapperVersion: string;
    itemsJson: unknown;
    summaryJson: unknown;
    updatedAt: Date;
  }, currentProfileRevision: number) {
    const items = parseStoredItems(draft.itemsJson);
    const profileRevisionAtExtraction = draft.targetProfileRevision ?? 0;
    return {
      resumeDocumentId: document.id,
      documentStatus: document.status,
      draftId: draft.id,
      draftSchemaVersion: draft.schemaVersion,
      reviewRevision: draft.reviewRevision,
      profileRevisionAtExtraction,
      currentProfileRevision,
      profileChangedSinceExtraction: profileRevisionAtExtraction !== currentProfileRevision,
      parser: {
        serviceVersion: draft.parserVersion,
        mapperVersion: draft.mapperVersion
      },
      sections: this.sections(items),
      summary: reviewSummary(items),
      updatedAt: draft.updatedAt.toISOString()
    };
  }

  private sections(items: StoredDraftItem[]) {
    const groups = new Map<string, { sectionHeading: string | null; category: string; items: unknown[] }>();
    for (const item of items) {
      const category = canonicalCategory(item);
      const sectionHeading = item.source.sectionHeading ?? null;
      const key = `${category}:${sectionHeading ?? ""}`;
      const group = groups.get(key) ?? { sectionHeading, category, items: [] };
      group.items.push(this.reviewItem(item, category));
      groups.set(key, group);
    }
    return [...groups.values()];
  }

  private reviewItem(item: StoredDraftItem, category: string) {
    const snippet = item.classification === "SENSITIVE_EXCLUDED"
      ? "This information was detected but will not be added to your RoleBrief profile."
      : item.originalText.slice(0, 500);
    return {
      id: item.id,
      category,
      classification: item.classification,
      snippet,
      suggestedValue: item.classification === "SENSITIVE_EXCLUDED" ? null : item.suggestedValue,
      source: {
        blockIds: item.source.blockIds,
        pageNumbers: item.source.pageNumbers,
        boundingBoxes: item.source.boundingBoxes,
        sectionHeading: item.source.sectionHeading
      },
      confidenceClass: item.confidenceClass,
      reasonCodes: item.reasonCodes,
      reviewState: item.reviewState,
      reviewDecision: item.reviewDecision ?? null
    };
  }

  private validateOperations(operations: UpdateResumeDraftReviewDto["operations"]) {
    const seen = new Set<string>();
    for (const operation of operations) {
      if (seen.has(operation.itemId)) throw new BadRequestException({ statusCode: 400, code: "DUPLICATE_REVIEW_ITEM", itemId: operation.itemId });
      seen.add(operation.itemId);
    }
  }

  private hashPayload(dto: UpdateResumeDraftReviewDto) {
    return createHash("sha256").update(stableStringify({
      draftId: dto.draftId,
      expectedReviewRevision: dto.expectedReviewRevision,
      operations: dto.operations
    })).digest("hex");
  }

  private objectSummary(summaryJson: unknown) {
    return summaryJson && typeof summaryJson === "object" && !Array.isArray(summaryJson) ? summaryJson as Record<string, unknown> : {};
  }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
