import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAuthEmail } from "./email.templates";

test("verification template builds a frontend-origin link", () => {
  const message = buildAuthEmail({
    template: "verify-email",
    to: "person@example.invalid",
    frontendOrigin: "https://app.rolebrief.example",
    token: "token with spaces"
  });

  assert.equal(message.subject, "Verify your RoleBrief email");
  assert.match(message.text, /https:\/\/app\.rolebrief\.example\/verify-email\?token=token%20with%20spaces/);
  assert.match(message.html, /Verify email/);
});

test("password-changed notice contains no security link", () => {
  const message = buildAuthEmail({
    template: "password-changed",
    to: "person@example.invalid",
    frontendOrigin: "https://app.rolebrief.example"
  });

  assert.equal(message.subject, "Your RoleBrief password changed");
  assert.doesNotMatch(message.text, /token=/);
  assert.doesNotMatch(message.html, /token=/);
});
