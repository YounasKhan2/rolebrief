import { BadRequestException } from "@nestjs/common";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { JobSortOption, JobsQueryDto } from "./dto/jobs-query.dto";

export interface KeysetCursorPayload {
  v: 1;
  sort: JobSortOption;
  val: Array<string | number | null>;
  id: string;
  qHash: string;
}

export function computeQueryHash(query: Partial<JobsQueryDto>): string {
  const normalized: Record<string, unknown> = {
    q: query.q?.trim().toLowerCase() || undefined,
    country: query.country?.slice().sort() || undefined,
    remoteScope: query.remoteScope?.slice().sort() || undefined,
    workMode: query.workMode?.slice().sort() || undefined,
    timezone: query.timezone?.slice().sort() || undefined,
    seniority: query.seniority?.slice().sort() || undefined,
    employmentType: query.employmentType?.slice().sort() || undefined,
    category: query.category?.slice().sort() || undefined,
    company: query.company?.slice().sort() || undefined,
    salaryMin: query.salaryMin !== undefined ? Number(query.salaryMin) : undefined,
    salaryMax: query.salaryMax !== undefined ? Number(query.salaryMax) : undefined,
    currency: query.currency?.trim().toUpperCase() || undefined,
    publishedAfter: query.publishedAfter || undefined,
    deadlineBefore: query.deadlineBefore || undefined,
    provider: query.provider || undefined,
    status: query.status || undefined,
    sort: query.sort || JobSortOption.NEWEST,
    excludeCategory: query.excludeCategory?.slice().sort() || undefined,
    excludeWorkMode: query.excludeWorkMode?.slice().sort() || undefined,
    excludeSeniority: query.excludeSeniority?.slice().sort() || undefined
  };

  const sortedKeys = Object.keys(normalized)
    .filter((k) => normalized[k] !== undefined)
    .sort();

  const stableObject: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    stableObject[key] = normalized[key];
  }

  return createHash("sha256")
    .update(JSON.stringify(stableObject))
    .digest("hex")
    .slice(0, 16);
}

export function encodeCursor(payload: KeysetCursorPayload, secret: string): string {
  if (!secret || typeof secret !== "string" || secret.length < 16) {
    throw new Error("A valid signing secret must be provided to encode cursors");
  }

  const payloadString = JSON.stringify(payload);
  const payloadBase64 = Buffer.from(payloadString, "utf8").toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(payloadBase64)
    .digest("base64url");

  return `${payloadBase64}.${signature}`;
}

export function decodeCursor(
  cursor: string,
  secret: string,
  expectedQHash?: string
): KeysetCursorPayload {
  if (!cursor || typeof cursor !== "string") {
    throw new BadRequestException("Invalid cursor format");
  }

  const dotIndex = cursor.indexOf(".");
  if (dotIndex <= 0 || dotIndex === cursor.length - 1) {
    throw new BadRequestException("Malformed cursor format: expected signed cursor token");
  }

  const payloadBase64 = cursor.slice(0, dotIndex);
  const signature = cursor.slice(dotIndex + 1);

  // Compute expected HMAC signature
  const expectedSignature = createHmac("sha256", secret)
    .update(payloadBase64)
    .digest("base64url");

  const sigBuffer = Buffer.from(signature, "utf8");
  const expectedSigBuffer = Buffer.from(expectedSignature, "utf8");

  // Constant-time signature verification
  if (
    sigBuffer.length !== expectedSigBuffer.length ||
    !timingSafeEqual(sigBuffer, expectedSigBuffer)
  ) {
    throw new BadRequestException("Invalid cursor signature");
  }

  let parsed: any;
  try {
    const raw = Buffer.from(payloadBase64, "base64url").toString("utf8");
    parsed = JSON.parse(raw);
  } catch {
    throw new BadRequestException("Malformed cursor payload");
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    parsed.v !== 1 ||
    typeof parsed.id !== "string" ||
    !parsed.sort ||
    !Object.values(JobSortOption).includes(parsed.sort) ||
    !Array.isArray(parsed.val)
  ) {
    throw new BadRequestException("Invalid cursor structure");
  }

  if (expectedQHash && parsed.qHash && parsed.qHash !== expectedQHash) {
    throw new BadRequestException(
      "Cursor is invalid for the current query/filter/sort parameters"
    );
  }

  return {
    v: 1,
    sort: parsed.sort,
    val: parsed.val,
    id: parsed.id,
    qHash: parsed.qHash || ""
  };
}
