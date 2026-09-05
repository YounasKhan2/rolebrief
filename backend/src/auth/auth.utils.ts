import { createHash, randomBytes } from "crypto";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function addSeconds(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * 1000);
}

export function redactEmail(email: string) {
  const [name, domain] = email.split("@");
  return `${name.slice(0, 2)}***@${domain ?? "unknown"}`;
}

export function userInitials(email: string) {
  return email.slice(0, 2).toUpperCase();
}

export function safeUserAgent(value: unknown) {
  if (typeof value !== "string") return undefined;
  return value.slice(0, 180);
}
