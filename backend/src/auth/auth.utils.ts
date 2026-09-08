import { createHash, createHmac, randomBytes } from "crypto";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function derivePublicSessionId(tokenFamilyId: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`session_family:${tokenFamilyId}`)
    .digest("hex")
    .slice(0, 32);
}

export function maskIpAddress(ip?: string | null): string | null {
  if (!ip) return null;
  const trimmed = ip.trim();
  if (trimmed.includes(":")) {
    const segments = trimmed.split(":");
    return segments.slice(0, 2).join(":") + ":****";
  }
  const parts = trimmed.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.***.***`;
  }
  return "***";
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

export interface ParsedDeviceInfo {
  browser: string;
  os: string;
  isMobile: boolean;
}

export function parseUserAgent(ua: string | null | undefined): ParsedDeviceInfo {
  if (!ua) {
    return { browser: "Unknown Browser", os: "Unknown Device", isMobile: false };
  }
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);

  let os = "Unknown OS";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser = "Unknown Browser";
  if (/Edg\//i.test(ua)) browser = "Microsoft Edge";
  else if (/Chrome\//i.test(ua) && !/Chromium|Edg/i.test(ua)) browser = "Google Chrome";
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = "Apple Safari";
  else if (/Firefox\//i.test(ua)) browser = "Mozilla Firefox";
  else if (/OPR|Opera/i.test(ua)) browser = "Opera";

  return { browser, os, isMobile };
}

