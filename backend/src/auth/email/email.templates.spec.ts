import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAuthEmail, escapeHtml } from "./email.templates";

test("escapeHtml sanitizes html special characters", () => {
  assert.equal(escapeHtml('<script>alert("xss")&\'</script>'), "&lt;script&gt;alert(&quot;xss&quot;)&amp;&#039;&lt;/script&gt;");
});

test("verification template builds a branded table layout with frontend link and fallback URL", () => {
  const message = buildAuthEmail({
    template: "verify-email",
    to: "person@example.invalid",
    frontendOrigin: "https://app.rolebrief.example",
    token: "token with spaces",
  });

  assert.equal(message.subject, "Verify your RoleBrief email");
  assert.match(message.text, /https:\/\/app\.rolebrief\.example\/verify-email\?token=token%20with%20spaces/);
  assert.match(message.text, /valid for 24 hours/);
  assert.match(message.html, /<table role="presentation"/);
  assert.match(message.html, /Role<span style="font-weight:400;color:#0ea5e9;">Brief<\/span>/);
  assert.match(message.html, /Verify email address/);
  assert.match(message.html, /Button not working\? Copy and paste this URL/);
  assert.match(message.html, /https:\/\/app\.rolebrief\.example\/verify-email\?token=token%20with%20spaces/);
  assert.match(message.html, /valid for 24 hours/);
});

test("reset-password template contains 30-minute expiry, fallback URL, and escaped recipient", () => {
  const message = buildAuthEmail({
    template: "reset-password",
    to: "attacker<script>@example.invalid",
    frontendOrigin: "https://app.rolebrief.example",
    token: "reset-token-xyz",
  });

  assert.equal(message.subject, "Reset your RoleBrief password");
  assert.match(message.text, /https:\/\/app\.rolebrief\.example\/reset-password\?token=reset-token-xyz/);
  assert.match(message.text, /expire in 30 minutes/);
  assert.match(message.html, /Reset your password/);
  assert.match(message.html, /expire in 30 minutes/);
  assert.doesNotMatch(message.html, /<script>/);
  assert.match(message.html, /attacker&lt;script&gt;@example\.invalid/);
});

test("password-changed notice contains no security link and mentions session revocation", () => {
  const message = buildAuthEmail({
    template: "password-changed",
    to: "person@example.invalid",
    frontendOrigin: "https://app.rolebrief.example",
  });

  assert.equal(message.subject, "Your RoleBrief password changed");
  assert.match(message.text, /All previous active login sessions have been revoked/);
  assert.match(message.html, /All previous active login sessions for your account have been revoked/);
  assert.doesNotMatch(message.text, /token=/);
  assert.doesNotMatch(message.html, /token=/);
});
