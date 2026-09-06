import assert from "node:assert/strict";
import { test } from "node:test";
import { envSchema } from "./env.schema";

const requiredEnv = {
  PUBLIC_APP_URL: "http://localhost:8443",
  DATABASE_URL: "postgresql://rolebrief:not-a-real-secret@localhost:5432/rolebrief?schema=public",
  REDIS_URL: "redis://localhost:6379",
  AUTH_ISSUER: "http://localhost:3000",
  AUTH_AUDIENCE: "rolebrief-web",
  SESSION_SECRET: "replace-with-a-32-character-dev-secret"
};

test("parses explicit false boolean strings as false", () => {
  const parsed = envSchema.parse({
    ...requiredEnv,
    HIMALAYAS_ENABLED: "false",
    HIMALAYAS_LIVE_SMOKE: "false"
  });

  assert.equal(parsed.HIMALAYAS_ENABLED, false);
  assert.equal(parsed.HIMALAYAS_LIVE_SMOKE, false);
  assert.deepEqual(parsed.FRONTEND_ORIGIN.split(","), [
    "http://localhost:8443",
    "http://127.0.0.1:8443",
    "http://127.0.0.1:5173",
    "http://localhost:5173"
  ]);
});

test("parses explicit true boolean strings as true", () => {
  const parsed = envSchema.parse({
    ...requiredEnv,
    HIMALAYAS_ENABLED: "true",
    HIMALAYAS_LIVE_SMOKE: "true"
  });

  assert.equal(parsed.HIMALAYAS_ENABLED, true);
  assert.equal(parsed.HIMALAYAS_LIVE_SMOKE, true);
});

test("requires resend credentials when Resend is selected", () => {
  const parsed = envSchema.safeParse({
    ...requiredEnv,
    EMAIL_PROVIDER: "resend",
    RESEND_FROM_EMAIL: "security@example.invalid"
  });

  assert.equal(parsed.success, false);
  assert.match(JSON.stringify(parsed.error.format()), /RESEND_API_KEY/);
});

test("rejects development link exposure in production", () => {
  const parsed = envSchema.safeParse({
    ...requiredEnv,
    NODE_ENV: "production",
    EMAIL_EXPOSE_DEV_LINKS: "true"
  });

  assert.equal(parsed.success, false);
  assert.match(JSON.stringify(parsed.error.format()), /EMAIL_EXPOSE_DEV_LINKS/);
});
