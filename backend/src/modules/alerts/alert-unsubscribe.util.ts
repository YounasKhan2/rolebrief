import { createHmac, timingSafeEqual } from "node:crypto";
import { BadRequestException } from "@nestjs/common";

export interface AlertUnsubscribePayload {
  alertId: string;
  userId: string;
  action: "pause" | "delete";
}

export function generateAlertUnsubscribeToken(
  alertId: string,
  userId: string,
  secret: string,
  action: "pause" | "delete" = "pause"
): string {
  const data = `${alertId}:${userId}:${action}`;
  const payloadB64 = Buffer.from(data, "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sig}`;
}

export function verifyAlertUnsubscribeToken(
  token: string,
  secret: string
): AlertUnsubscribePayload {
  if (!token || typeof token !== "string") {
    throw new BadRequestException("Invalid unsubscribe token.");
  }

  const dotIndex = token.indexOf(".");
  if (dotIndex <= 0 || dotIndex === token.length - 1) {
    throw new BadRequestException("Malformed unsubscribe token.");
  }

  const payloadB64 = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);

  const expectedSignature = createHmac("sha256", secret)
    .update(payloadB64)
    .digest("base64url");

  const sigBuffer = Buffer.from(signature, "utf8");
  const expectedSigBuffer = Buffer.from(expectedSignature, "utf8");

  if (
    sigBuffer.length !== expectedSigBuffer.length ||
    !timingSafeEqual(sigBuffer, expectedSigBuffer)
  ) {
    throw new BadRequestException("Invalid or expired unsubscribe signature.");
  }

  let raw = "";
  try {
    raw = Buffer.from(payloadB64, "base64url").toString("utf8");
  } catch {
    throw new BadRequestException("Invalid unsubscribe token encoding.");
  }

  const [alertId, userId, action] = raw.split(":");
  if (!alertId || !userId || (action !== "pause" && action !== "delete")) {
    throw new BadRequestException("Malformed unsubscribe token payload.");
  }

  return { alertId, userId, action };
}
