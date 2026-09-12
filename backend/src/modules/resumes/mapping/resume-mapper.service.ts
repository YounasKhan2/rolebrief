import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { DoclingExtraction } from "../../../infrastructure/internal-services/docling/docling-contract";

export const RESUME_MAPPER_VERSION = "rolebrief-resume-mapper-v1";

const HEADING_ALIASES: Record<string, string> = {
  "profile": "contact",
  "contact": "contact",
  "contact information": "contact",
  "summary": "summary",
  "professional summary": "summary",
  "objective": "summary",
  "experience": "experience",
  "work experience": "experience",
  "employment": "experience",
  "professional experience": "experience",
  "education": "education",
  "skills": "skills",
  "technical skills": "skills",
  "projects": "projects",
  "certifications": "certifications",
  "certifications licences": "certifications",
  "licenses": "certifications",
  "licences": "certifications",
  "awards": "awards",
  "publications": "publications",
  "languages": "languages",
  "volunteering": "volunteering",
  "memberships": "memberships",
  "links": "links",
  "portfolio": "links",
  "research": "research",
  "patents": "patents",
  "references": "references"
};

type DraftClassification =
  | "EXTRACTED_CONFIDENTLY"
  | "NEEDS_CONFIRMATION"
  | "OTHER_INFORMATION_FOUND"
  | "UNSUPPORTED_OR_UNREADABLE"
  | "SENSITIVE_EXCLUDED";

type DraftItem = {
  id: string;
  category: string;
  classification: DraftClassification;
  originalText: string;
  suggestedValue: unknown | null;
  source: {
    blockIds: string[];
    pageNumbers: number[];
    boundingBoxes: Array<{ x: number; y: number; width: number; height: number }>;
    sectionHeading: string | null;
  };
  provenance: "RESUME_PARSED";
  confidenceClass: "HIGH" | "MEDIUM" | "LOW";
  reasonCodes: string[];
  reviewState: "PENDING";
};

@Injectable()
export class ResumeMapperService {
  map(extraction: DoclingExtraction, input: { artifactId: string; sourceChecksum: string }) {
    const blocks = extraction.blocks
      .filter((block) => block.text.trim().length > 0)
      .sort((a, b) => a.readingOrder - b.readingOrder);
    const sections: Array<{ heading: string | null; category: string; blocks: typeof blocks }> = [];
    let current: { heading: string | null; category: string; blocks: typeof blocks } = {
      heading: null,
      category: "custom",
      blocks: []
    };

    for (const block of blocks) {
      const alias = this.headingCategory(block.text);
      const unknownHeading = !alias && block.kind === "heading" && block.text.trim().length <= 120;
      if (alias && current.blocks.length > 0) {
        sections.push(current);
        current = { heading: block.text.trim(), category: alias, blocks: [] };
      } else if (alias) {
        current = { heading: block.text.trim(), category: alias, blocks: [] };
      } else if (unknownHeading) {
        if (current.blocks.length > 0) sections.push(current);
        current = { heading: block.text.trim(), category: "custom", blocks: [] };
      } else {
        current.blocks.push(block);
      }
    }
    if (current.blocks.length > 0) sections.push(current);

    const items: DraftItem[] = sections.flatMap((section, sectionIndex): DraftItem[] => {
      if (section.category === "skills") return this.skillItems(section, input, sectionIndex);
      return section.blocks.map((block, blockIndex) => this.itemFromBlock(section, block, input, sectionIndex, blockIndex));
    }).slice(0, 500);

    const summary = {
      itemCount: items.length,
      warningCount: extraction.warnings.length,
      categoryCounts: items.reduce<Record<string, number>>((acc, item) => {
        acc[item.category] = (acc[item.category] ?? 0) + 1;
        return acc;
      }, {})
    };

    return { items, summary, warnings: extraction.warnings };
  }

  private itemFromBlock(section: { heading: string | null; category: string }, block: DoclingExtraction["blocks"][number], input: { artifactId: string }, sectionIndex: number, blockIndex: number): DraftItem {
    const sensitive = this.isSensitive(block.text);
    const classification: DraftClassification = sensitive
      ? "SENSITIVE_EXCLUDED"
      : section.category === "custom" || section.category === "references"
        ? "OTHER_INFORMATION_FOUND"
        : this.needsConfirmation(block.text)
          ? "NEEDS_CONFIRMATION"
          : "EXTRACTED_CONFIDENTLY";
    return {
      id: this.stableId(input.artifactId, block.id, section.category, sectionIndex, blockIndex),
      category: section.category,
      classification,
      originalText: block.text,
      suggestedValue: classification === "SENSITIVE_EXCLUDED" ? null : { text: block.text },
      source: {
        blockIds: [block.id],
        pageNumbers: block.pageNumber ? [block.pageNumber] : [],
        boundingBoxes: block.boundingBox ? [block.boundingBox] : [],
        sectionHeading: section.heading
      },
      provenance: "RESUME_PARSED",
      confidenceClass: classification === "EXTRACTED_CONFIDENTLY" ? "HIGH" : classification === "NEEDS_CONFIRMATION" ? "MEDIUM" : "LOW",
      reasonCodes: this.reasonCodes(classification, block.text),
      reviewState: "PENDING"
    };
  }

  private skillItems(section: { heading: string | null; category: string; blocks: DoclingExtraction["blocks"] }, input: { artifactId: string }, sectionIndex: number): DraftItem[] {
    const sourceBlocks = section.blocks;
    const text = sourceBlocks.map((block) => block.text).join("\n");
    const skills = text.split(/[,;•\n]/).map((part) => part.trim()).filter((part) => part.length >= 2).slice(0, 100);
    if (skills.length === 0) {
      return sourceBlocks.map((block, blockIndex) => this.itemFromBlock(section, block, input, sectionIndex, blockIndex));
    }
    return skills.map((skill, index) => {
      const block = sourceBlocks[Math.min(index, sourceBlocks.length - 1)];
      return {
        id: this.stableId(input.artifactId, block.id, "skills", sectionIndex, index),
        category: "skills",
        classification: "NEEDS_CONFIRMATION" as const,
        originalText: skill,
        suggestedValue: { name: skill },
        source: {
          blockIds: [block.id],
          pageNumbers: block.pageNumber ? [block.pageNumber] : [],
          boundingBoxes: block.boundingBox ? [block.boundingBox] : [],
          sectionHeading: section.heading
        },
        provenance: "RESUME_PARSED",
        confidenceClass: "MEDIUM",
        reasonCodes: ["SKILL_CANDIDATE_REQUIRES_REVIEW"],
        reviewState: "PENDING"
      };
    });
  }

  private headingCategory(text: string): string | null {
    const normalized = this.normalizeHeading(text);
    return HEADING_ALIASES[normalized] ?? null;
  }

  private normalizeHeading(text: string) {
    return text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  }

  private isSensitive(text: string) {
    return /\b(date of birth|birth date|national id|passport|marital status|ssn|social security|photo|photograph)\b/i.test(text);
  }

  private needsConfirmation(text: string) {
    return /\b(present|current|ongoing|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{4})\b/i.test(text);
  }

  private reasonCodes(classification: DraftClassification, text: string) {
    if (classification === "SENSITIVE_EXCLUDED") return ["SENSITIVE_CONTENT_EXCLUDED"];
    if (classification === "NEEDS_CONFIRMATION") return ["AMBIGUOUS_OR_DATE_LIKE_CONTENT_REQUIRES_REVIEW"];
    if (classification === "OTHER_INFORMATION_FOUND") return ["UNMAPPED_SECTION_PRESERVED"];
    if (text.length > 1000) return ["LONG_BLOCK_REQUIRES_REVIEW"];
    return ["DETERMINISTIC_SECTION_MAPPING"];
  }

  private stableId(...parts: Array<string | number>) {
    return `rdi_${createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 24)}`;
  }
}
