import { z } from "zod";

const booleanString = z.preprocess((value) => {
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return value;
}, z.boolean());

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  PUBLIC_APP_URL: z.string().url(),
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_SIZE: z.coerce.number().int().positive().default(10),
  REDIS_URL: z.string().url(),
  QUEUE_PREFIX: z.string().min(1).default("rb:v1"),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
  AUTH_ISSUER: z.string().url(),
  AUTH_AUDIENCE: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  HIMALAYAS_ENABLED: booleanString.default(false),
  HIMALAYAS_API_URL: z.string().url().default("https://himalayas.app/jobs/api"),
  HIMALAYAS_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  HIMALAYAS_PAGE_LIMIT: z.coerce.number().int().min(1).max(20).default(20),
  HIMALAYAS_MAX_PAGES_PER_RUN: z.coerce.number().int().positive().default(5),
  HIMALAYAS_RETRY_ATTEMPTS: z.coerce.number().int().min(0).default(2),
  HIMALAYAS_RETRY_DELAY_MS: z.coerce.number().int().nonnegative().default(500),
  HIMALAYAS_RATE_LIMIT_DELAY_MS: z.coerce.number().int().nonnegative().default(1000),
  HIMALAYAS_CRON: z.string().min(1).default("0 3 * * *"),
  HIMALAYAS_LIVE_SMOKE: booleanString.default(false),
  APITUBE_API_KEY: z.string().optional().default(""),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional().or(z.literal("")),
  SENTRY_DSN: z.string().url().optional().or(z.literal(""))
});

export type Env = z.infer<typeof envSchema>;
