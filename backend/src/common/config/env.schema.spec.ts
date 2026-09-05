import assert from "node:assert/strict";
import { test } from "node:test";
import { envSchema } from "./env.schema";

const requiredEnv = {
  PUBLIC_APP_URL: "http://localhost:8443",
  DATABASE_URL: "postgresql://rolebrief:rolebrief_dev_password@localhost:5432/rolebrief?schema=public",
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
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "http://127.0.0.1:8443",
    "http://localhost:8443"
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
