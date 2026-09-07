import assert from "node:assert/strict";
import { test } from "node:test";
import { sanitizeReturnTo, buildReturnToQuery } from "./routing";

test("sanitizeReturnTo: accepts valid relative paths with query and hash", () => {
  assert.equal(sanitizeReturnTo("/app/radar"), "/app/radar");
  assert.equal(sanitizeReturnTo("/app/news"), "/app/news");
  assert.equal(sanitizeReturnTo("/app/news/ai-chip-expansion-q3?tab=hiring#reactions"), "/app/news/ai-chip-expansion-q3?tab=hiring#reactions");
  assert.equal(sanitizeReturnTo("/app/saved?sort=newest#top"), "/app/saved?sort=newest#top");
  assert.equal(sanitizeReturnTo("/jobs/acme-senior-engineer"), "/jobs/acme-senior-engineer");
  assert.equal(sanitizeReturnTo("/news/tech-hiring-trends?filter=remote"), "/news/tech-hiring-trends?filter=remote");
});

test("sanitizeReturnTo: rejects absolute external URLs and protocol-relative attacks", () => {
  assert.equal(sanitizeReturnTo("https://evil.com"), "/app/radar");
  assert.equal(sanitizeReturnTo("http://evil.com/app/radar"), "/app/radar");
  assert.equal(sanitizeReturnTo("//evil.com"), "/app/radar");
  assert.equal(sanitizeReturnTo("/\\evil.com"), "/app/radar");
  assert.equal(sanitizeReturnTo("/\\\\evil.com"), "/app/radar");
  assert.equal(sanitizeReturnTo("/\\/evil.com"), "/app/radar");
  assert.equal(sanitizeReturnTo("javascript:alert(1)"), "/app/radar");
  assert.equal(sanitizeReturnTo("data:text/html,<script>"), "/app/radar");
  assert.equal(sanitizeReturnTo("vbscript:msgbox"), "/app/radar");
});

test("sanitizeReturnTo: rejects control characters, null bytes, and backslashes in paths", () => {
  assert.equal(sanitizeReturnTo("/app/radar\u0000"), "/app/radar");
  assert.equal(sanitizeReturnTo("/app/radar\r\n"), "/app/radar");
  assert.equal(sanitizeReturnTo("/app\\radar"), "/app/radar");
});

test("sanitizeReturnTo: rejects recursive auth destinations", () => {
  assert.equal(sanitizeReturnTo("/login"), "/app/radar");
  assert.equal(sanitizeReturnTo("/signup"), "/app/radar");
  assert.equal(sanitizeReturnTo("/forgot-password"), "/app/radar");
  assert.equal(sanitizeReturnTo("/reset-password"), "/app/radar");
  assert.equal(sanitizeReturnTo("/login/"), "/app/radar");
  assert.equal(sanitizeReturnTo("/login?returnTo=/app/radar"), "/app/radar");
});

test("sanitizeReturnTo: enforces role compatibility", () => {
  // USER cannot return to /admin routes
  assert.equal(sanitizeReturnTo("/admin", "USER"), "/app/radar");
  assert.equal(sanitizeReturnTo("/admin/sources", "USER"), "/app/radar");
  assert.equal(sanitizeReturnTo("/admin/moderation", "USER"), "/app/radar");
  assert.equal(sanitizeReturnTo("/app/radar", "USER"), "/app/radar");

  // ADMIN can return to /admin routes or /app routes
  assert.equal(sanitizeReturnTo("/admin", "ADMIN"), "/admin");
  assert.equal(sanitizeReturnTo("/admin/sources", "ADMIN"), "/admin/sources");
  assert.equal(sanitizeReturnTo("/app/radar", "ADMIN"), "/app/radar");
  assert.equal(sanitizeReturnTo("/login", "ADMIN"), "/admin");
  assert.equal(sanitizeReturnTo(null, "ADMIN"), "/admin");
});

test("buildReturnToQuery: cleanly builds query parameter preserving search and hash", () => {
  assert.equal(
    buildReturnToQuery("/app/saved", "?sort=newest", "#heading"),
    "?returnTo=%2Fapp%2Fsaved%3Fsort%3Dnewest%23heading"
  );
  assert.equal(
    buildReturnToQuery("/app/radar"),
    "?returnTo=%2Fapp%2Fradar"
  );
  // Unsafe fallback returns safe encoded target
  assert.equal(
    buildReturnToQuery("https://evil.com"),
    "?returnTo=%2Fapp%2Fradar"
  );
});
