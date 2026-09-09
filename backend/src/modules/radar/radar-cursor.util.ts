import { BadRequestException } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import { RadarCursorPayload } from "./radar.types";

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function encodeRadarCursor(payload: RadarCursorPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

export function decodeRadarCursor(cursor: string, secret: string): RadarCursorPayload {
  const [body, signature] = cursor.split(".");
  if (!body || !signature) throw new BadRequestException("Invalid radar cursor.");
  const expected = sign(body, secret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw new BadRequestException("Invalid radar cursor.");
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as RadarCursorPayload;
    if (payload.v !== 1 || !payload.feedSnapshotId || !payload.userId || !payload.expiresAt) {
      throw new Error("malformed");
    }
    if (new Date(payload.expiresAt).getTime() <= Date.now()) {
      throw new BadRequestException("Radar cursor expired.");
    }
    return payload;
  } catch (err) {
    if (err instanceof BadRequestException) throw err;
    throw new BadRequestException("Invalid radar cursor.");
  }
}

export function radarQueryKey(value: Record<string, unknown>): string {
  return JSON.stringify(
    Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        const current = value[key];
        acc[key] = Array.isArray(current) ? [...current].sort() : current ?? null;
        return acc;
      }, {})
  );
}
