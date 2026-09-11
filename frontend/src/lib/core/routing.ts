import type { AuthRole } from "../auth/auth-api";

const RECURSIVE_AUTH_PATHS = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
]);

/**
 * Validates and sanitizes a returnTo path.
 *
 * Rules:
 * 1. Must be a relative internal path starting with a single '/'
 * 2. Rejects protocol-relative '//', '/\', '/\\' bypasses
 * 3. Rejects scheme prefixes (http:, https:, javascript:, data:, etc.)
 * 4. Rejects control characters, newlines, and null bytes
 * 5. Rejects recursive auth routes (/login, /signup, /forgot-password, /reset-password)
 * 6. Role-aware:
 *    - USER role cannot return to /admin/* (redirects to USER default)
 *    - ADMIN role can return to /admin/* or /app/* (defaults to /admin)
 *    - Guest / unspecified role defaults to /app/radar
 */
export function sanitizeReturnTo(raw: unknown, role?: AuthRole): string {
  const defaultDestination = role === "ADMIN" ? "/admin" : "/app/radar";

  if (typeof raw !== "string") {
    return defaultDestination;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return defaultDestination;
  }

  // Reject control characters, newlines, null bytes
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) {
    return defaultDestination;
  }

  // Must begin with single slash; reject protocol-relative slashes/backslashes
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\") || trimmed.startsWith("/\\\\")) {
    return defaultDestination;
  }

  // Disallow scheme indicators or backslash variations anywhere before query/hash
  const pathPart = trimmed.split(/[?#]/)[0];
  if (pathPart.includes("\\") || pathPart.includes(":") || pathPart.includes("@")) {
    return defaultDestination;
  }

  // Parse against dummy same-origin base to extract canonical pathname, search, and hash
  let parsed: URL;
  try {
    parsed = new URL(trimmed, "http://rolebrief.local");
  } catch {
    return defaultDestination;
  }

  // Verify host remained the local dummy origin (guards against hostname injection)
  if (parsed.origin !== "http://rolebrief.local") {
    return defaultDestination;
  }

  const pathname = parsed.pathname;
  const search = parsed.search;
  const hash = parsed.hash;

  // Reject recursive auth routes (including with or without trailing slash)
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/";
  if (RECURSIVE_AUTH_PATHS.has(normalizedPathname)) {
    return defaultDestination;
  }

  // Role compatibility check: USER cannot navigate into /admin
  if (role === "USER" && (normalizedPathname === "/admin" || normalizedPathname.startsWith("/admin/"))) {
    return defaultDestination;
  }

  return `${pathname}${search}${hash}`;
}

/**
 * Builds a query string parameter containing the encoded returnTo destination.
 * Preserves pathname, search params, and hash fragment.
 */
export function buildReturnToQuery(pathname: string, search = "", hash = ""): string {
  const fullPath = `${pathname}${search}${hash}`;
  const sanitized = sanitizeReturnTo(fullPath);
  return `?returnTo=${encodeURIComponent(sanitized)}`;
}
