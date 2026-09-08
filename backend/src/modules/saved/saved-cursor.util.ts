import { BadRequestException } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";

export interface SavedCursorPayload {
  v: 1;
  userId: string;
  id: string;
  createdAt: string;
}

export function encodeSavedCursor(payload: SavedCursorPayload, secret: string): string {
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

export function decodeSavedCursor(
  cursor: string,
  secret: string,
  expectedUserId: string
): SavedCursorPayload {
  if (!cursor || typeof cursor !== "string") {
    throw new BadRequestException("Invalid cursor format");
  }

  const dotIndex = cursor.indexOf(".");
  if (dotIndex <= 0 || dotIndex === cursor.length - 1) {
    throw new BadRequestException("Malformed cursor format: expected signed cursor token");
  }

  const payloadBase64 = cursor.slice(0, dotIndex);
  const signature = cursor.slice(dotIndex + 1);

  const expectedSignature = createHmac("sha256", secret)
    .update(payloadBase64)
    .digest("base64url");

  const sigBuffer = Buffer.from(signature, "utf8");
  const expectedSigBuffer = Buffer.from(expectedSignature, "utf8");

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
    typeof parsed.userId !== "string" ||
    typeof parsed.createdAt !== "string"
  ) {
    throw new BadRequestException("Invalid cursor structure");
  }

  if (parsed.userId !== expectedUserId) {
    throw new BadRequestException("Cursor belongs to another user session");
  }

  return {
    v: 1,
    userId: parsed.userId,
    id: parsed.id,
    createdAt: parsed.createdAt
  };
}
