import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { AppConfigService } from "../../../common/config/app-config.service";
import { DoclingExtraction, doclingExtractionSchema } from "./docling-contract";

export class DoclingUnavailableError extends Error {}
export class DoclingTimeoutError extends Error {}
export class DoclingProtocolError extends Error {}
export class DoclingOutputInvalidError extends Error {}
export class DoclingOutputTooLargeError extends Error {}

@Injectable()
export class DoclingClientService {
  constructor(private readonly config: AppConfigService) {}

  async extract(input: {
    documentRef: string;
    mediaType: string;
    bytes: Buffer;
    ocrPolicy: "auto" | "disabled";
    deadlineMs: number;
  }): Promise<DoclingExtraction> {
    const cfg = this.config.resumes.extraction;
    const form = new FormData();
    form.set("contractVersion", "1");
    form.set("documentRef", input.documentRef);
    form.set("mediaType", input.mediaType);
    form.set("ocrPolicy", input.ocrPolicy);
    form.set("deadlineMs", String(input.deadlineMs));
    form.set("file", new Blob([new Uint8Array(input.bytes)], { type: input.mediaType }), "document.bin");

    let response: Response;
    try {
      response = await fetch(new URL("/internal/v1/documents/extract", cfg.serviceUrl), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.internalToken}`,
          "X-RoleBrief-Contract": "docling-v1"
        },
        body: form,
        redirect: "error",
        signal: AbortSignal.timeout(Math.min(cfg.timeoutMs, input.deadlineMs))
      });
    } catch (error: any) {
      if (error?.name === "TimeoutError" || error?.name === "AbortError") throw new DoclingTimeoutError("Docling timed out.");
      throw new DoclingUnavailableError("Docling is unavailable.");
    }

    if (response.status === 413) throw new DoclingOutputTooLargeError("Docling output too large.");
    if (response.status === 422) throw new DoclingOutputInvalidError("Docling could not extract the document.");
    if (response.status === 408 || response.status === 504) throw new DoclingTimeoutError("Docling timed out.");
    if (response.status === 503 || response.status === 429) throw new DoclingUnavailableError("Docling unavailable.");
    if (!response.ok || !response.body) throw new DoclingProtocolError("Docling protocol error.");

    const bytes = await this.readBounded(response, cfg.responseMaxBytes);
    let parsed: unknown;
    try {
      parsed = JSON.parse(bytes.toString("utf8"));
    } catch {
      throw new DoclingOutputInvalidError("Docling returned invalid JSON.");
    }
    const result = doclingExtractionSchema.safeParse(parsed);
    if (!result.success) throw new DoclingOutputInvalidError("Docling response schema invalid.");
    const totalText = result.data.blocks.reduce((sum, block) => sum + Buffer.byteLength(block.text, "utf8"), 0);
    if (result.data.blocks.length > cfg.maxBlocks || totalText > cfg.maxTextBytes) {
      throw new DoclingOutputTooLargeError("Docling response exceeded configured limits.");
    }
    return result.data;
  }

  async ready(): Promise<boolean> {
    try {
      const response = await fetch(new URL("/internal/v1/health/ready", this.config.resumes.extraction.serviceUrl), {
        signal: AbortSignal.timeout(1000),
        redirect: "error"
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async readBounded(response: Response, maxBytes: number): Promise<Buffer> {
    const reader = response.body?.getReader();
    if (!reader) throw new ServiceUnavailableException("Docling response unavailable.");
    const chunks: Buffer[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new DoclingOutputTooLargeError("Docling response exceeded configured limit.");
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, total);
  }
}
