import { BadRequestException, UnprocessableEntityException } from "@nestjs/common";
import { z } from "zod";
import { ResumeReviewActionDto, ResumeReviewCategoryDto, ResumeReviewOperationDto } from "../dto/review/resume-review.dto";

export const REVIEW_ITEM_SCHEMA_VERSION = 1;

export const draftItemSchema = z.object({
  id: z.string().regex(/^rdi_[a-f0-9]{24}$/),
  category: z.string().max(80),
  classification: z.enum([
    "EXTRACTED_CONFIDENTLY",
    "NEEDS_CONFIRMATION",
    "OTHER_INFORMATION_FOUND",
    "UNSUPPORTED_OR_UNREADABLE",
    "SENSITIVE_EXCLUDED"
  ]),
  originalText: z.string(),
  suggestedValue: z.unknown().nullable(),
  source: z.object({
    blockIds: z.array(z.string().max(120)).max(20),
    pageNumbers: z.array(z.number().int().positive()).max(20),
    boundingBoxes: z.array(z.object({
      x0: z.number().finite(),
      y0: z.number().finite(),
      x1: z.number().finite(),
      y1: z.number().finite()
    })).max(20),
    sectionHeading: z.string().max(160).nullable()
  }),
  provenance: z.literal("RESUME_PARSED"),
  confidenceClass: z.enum(["HIGH", "MEDIUM", "LOW"]),
  reasonCodes: z.array(z.string().max(120)).max(20),
  reviewState: z.enum(["PENDING", "ACCEPTED", "EDITED_ACCEPTED", "REJECTED", "CATEGORIZED"]).default("PENDING"),
  reviewDecision: z.unknown().optional()
});

export type StoredDraftItem = z.infer<typeof draftItemSchema>;

const categoryByMapperCategory: Record<string, ResumeReviewCategoryDto> = {
  contact: ResumeReviewCategoryDto.CONTACT,
  summary: ResumeReviewCategoryDto.SUMMARY,
  experience: ResumeReviewCategoryDto.EMPLOYMENT,
  education: ResumeReviewCategoryDto.EDUCATION,
  skills: ResumeReviewCategoryDto.SKILL,
  projects: ResumeReviewCategoryDto.PROJECT,
  certifications: ResumeReviewCategoryDto.CERTIFICATION,
  languages: ResumeReviewCategoryDto.LANGUAGE,
  awards: ResumeReviewCategoryDto.AWARD,
  publications: ResumeReviewCategoryDto.PUBLICATION,
  volunteering: ResumeReviewCategoryDto.VOLUNTEERING,
  memberships: ResumeReviewCategoryDto.MEMBERSHIP,
  research: ResumeReviewCategoryDto.RESEARCH,
  patents: ResumeReviewCategoryDto.PATENT,
  links: ResumeReviewCategoryDto.PORTFOLIO_LINK,
  references: ResumeReviewCategoryDto.REFERENCE,
  custom: ResumeReviewCategoryDto.CUSTOM_SECTION
};

const textValue = z.object({ text: z.string().min(1).max(4000) }).strict();
const skillValue = z.object({ name: z.string().min(1).max(120) }).strict();
const linkValue = z.object({ url: z.string().url().max(500), label: z.string().max(160).optional() }).strict();
const categorySchemas: Partial<Record<ResumeReviewCategoryDto, z.ZodTypeAny>> = {
  [ResumeReviewCategoryDto.IDENTITY]: textValue,
  [ResumeReviewCategoryDto.CONTACT]: textValue,
  [ResumeReviewCategoryDto.SUMMARY]: textValue,
  [ResumeReviewCategoryDto.EMPLOYMENT]: textValue,
  [ResumeReviewCategoryDto.EDUCATION]: textValue,
  [ResumeReviewCategoryDto.SKILL]: skillValue,
  [ResumeReviewCategoryDto.PROJECT]: textValue,
  [ResumeReviewCategoryDto.CERTIFICATION]: textValue,
  [ResumeReviewCategoryDto.LICENCE]: textValue,
  [ResumeReviewCategoryDto.LANGUAGE]: z.object({ name: z.string().min(1).max(120), proficiency: z.string().max(80).optional() }).strict(),
  [ResumeReviewCategoryDto.AWARD]: textValue,
  [ResumeReviewCategoryDto.PUBLICATION]: textValue,
  [ResumeReviewCategoryDto.VOLUNTEERING]: textValue,
  [ResumeReviewCategoryDto.MEMBERSHIP]: textValue,
  [ResumeReviewCategoryDto.RESEARCH]: textValue,
  [ResumeReviewCategoryDto.PATENT]: textValue,
  [ResumeReviewCategoryDto.PORTFOLIO_LINK]: linkValue,
  [ResumeReviewCategoryDto.REFERENCE]: textValue,
  [ResumeReviewCategoryDto.ADDITIONAL_INFORMATION]: textValue,
  [ResumeReviewCategoryDto.CUSTOM_SECTION]: textValue
};

export function parseStoredItems(itemsJson: unknown): StoredDraftItem[] {
  const parsed = z.array(draftItemSchema).max(500).parse(itemsJson);
  return parsed.map((item) => ({ ...item, reviewState: item.reviewState ?? "PENDING" }));
}

export function canonicalCategory(item: StoredDraftItem): ResumeReviewCategoryDto {
  if (item.classification === "SENSITIVE_EXCLUDED") return ResumeReviewCategoryDto.SENSITIVE_EXCLUDED;
  if (item.classification === "UNSUPPORTED_OR_UNREADABLE") return ResumeReviewCategoryDto.UNSUPPORTED;
  return categoryByMapperCategory[item.category] ?? ResumeReviewCategoryDto.CUSTOM_SECTION;
}

export function applyReviewOperation(item: StoredDraftItem, operation: ResumeReviewOperationDto): StoredDraftItem {
  const note = normalizeOptionalText(operation.note, 500);
  if (item.classification === "SENSITIVE_EXCLUDED" && (operation.action === "ACCEPT" || operation.action === "EDIT_AND_ACCEPT")) {
    throw new UnprocessableEntityException({ code: "SENSITIVE_ITEM_NOT_ACCEPTABLE", itemId: item.id });
  }
  if (item.classification === "UNSUPPORTED_OR_UNREADABLE" && (operation.action === "ACCEPT" || operation.action === "EDIT_AND_ACCEPT")) {
    throw new UnprocessableEntityException({ code: "UNSUPPORTED_ITEM_NOT_ACCEPTABLE", itemId: item.id });
  }

  if (operation.action === ResumeReviewActionDto.ACCEPT) {
    if (item.suggestedValue === null || item.suggestedValue === undefined) {
      throw new UnprocessableEntityException({ code: "ITEM_HAS_NO_SUGGESTED_VALUE", itemId: item.id });
    }
    return {
      ...item,
      reviewState: "ACCEPTED",
      reviewDecision: {
        action: "ACCEPT",
        category: canonicalCategory(item),
        acceptedValue: item.suggestedValue,
        note,
        decidedAt: new Date().toISOString()
      }
    };
  }

  if (operation.action === ResumeReviewActionDto.EDIT_AND_ACCEPT) {
    const category = operation.targetCategory ?? canonicalCategory(item);
    const editedValue = validateEditedValue(category, operation.editedValue);
    return {
      ...item,
      reviewState: "EDITED_ACCEPTED",
      reviewDecision: {
        action: "EDIT_AND_ACCEPT",
        category,
        editedValue,
        provenance: "USER_CONFIRMED_EDIT",
        note,
        decidedAt: new Date().toISOString()
      }
    };
  }

  if (operation.action === ResumeReviewActionDto.REJECT) {
    return {
      ...item,
      reviewState: "REJECTED",
      reviewDecision: { action: "REJECT", note, decidedAt: new Date().toISOString() }
    };
  }

  if (operation.action === ResumeReviewActionDto.CATEGORIZE) {
    if (!operation.targetCategory) throw new BadRequestException({ code: "TARGET_CATEGORY_REQUIRED", itemId: item.id });
    if (item.classification === "SENSITIVE_EXCLUDED" && operation.targetCategory !== ResumeReviewCategoryDto.SENSITIVE_EXCLUDED) {
      throw new UnprocessableEntityException({ code: "SENSITIVE_CATEGORY_LOCKED", itemId: item.id });
    }
    if (item.classification === "UNSUPPORTED_OR_UNREADABLE" && operation.targetCategory !== ResumeReviewCategoryDto.UNSUPPORTED) {
      throw new UnprocessableEntityException({ code: "UNSUPPORTED_CATEGORY_LOCKED", itemId: item.id });
    }
    return {
      ...item,
      reviewState: "CATEGORIZED",
      reviewDecision: {
        action: "CATEGORIZE",
        category: operation.targetCategory,
        customLabel: normalizeOptionalText(operation.customLabel, 80),
        note,
        decidedAt: new Date().toISOString()
      }
    };
  }

  throw new BadRequestException({ code: "UNSUPPORTED_REVIEW_ACTION", itemId: item.id });
}

function validateEditedValue(category: ResumeReviewCategoryDto, value: unknown) {
  const schema = categorySchemas[category];
  if (!schema) throw new UnprocessableEntityException({ code: "CATEGORY_NOT_EDITABLE", category });
  const parsed = schema.parse(value);
  const json = JSON.stringify(parsed);
  if (json.length > 5000) throw new BadRequestException({ code: "EDITED_VALUE_TOO_LARGE" });
  if (category === ResumeReviewCategoryDto.PORTFOLIO_LINK) {
    const url = new URL((parsed as { url: string }).url);
    if (!["http:", "https:"].includes(url.protocol)) throw new BadRequestException({ code: "UNSAFE_URL_SCHEME" });
  }
  return deepNormalize(parsed);
}

function normalizeOptionalText(value: string | undefined, max: number) {
  if (value === undefined) return undefined;
  const normalized = value.normalize("NFKC").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  return normalized.slice(0, max);
}

function deepNormalize(value: unknown): unknown {
  if (typeof value === "string") return normalizeOptionalText(value, value.length) ?? "";
  if (Array.isArray(value)) return value.map(deepNormalize);
  if (value && typeof value === "object") {
    if (
      Object.prototype.hasOwnProperty.call(value, "__proto__") ||
      Object.prototype.hasOwnProperty.call(value, "constructor") ||
      Object.prototype.hasOwnProperty.call(value, "prototype")
    ) {
      throw new BadRequestException({ code: "UNSAFE_OBJECT_KEY" });
    }
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, deepNormalize(child)]));
  }
  return value;
}
