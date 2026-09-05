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
  FRONTEND_ORIGIN: z.string().min(1).default("http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:8443,http://localhost:8443"),
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_SIZE: z.coerce.number().int().positive().default(10),
  REDIS_URL: z.string().url(),
  QUEUE_PREFIX: z.string().min(1).default("rb:v1"),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
  AUTH_ISSUER: z.string().url(),
  AUTH_AUDIENCE: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.coerce.number().int().positive().default(900),
  REFRESH_SESSION_TTL: z.coerce.number().int().positive().default(2592000),
  COOKIE_SECURE: booleanString.default(false),
  COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
  AUTH_RATE_LIMIT_LOGIN: z.coerce.number().int().positive().default(10),
  AUTH_RATE_LIMIT_SIGNUP: z.coerce.number().int().positive().default(5),
  AUTH_RATE_LIMIT_RECOVERY: z.coerce.number().int().positive().default(5),
  AUTH_RATE_LIMIT_REFRESH: z.coerce.number().int().positive().default(60),
  EMAIL_FROM: z.string().optional().default(""),
  EMAIL_PROVIDER: z.enum(["dev", "resend", "smtp"]).default("dev"),
  SMTP_URL: z.string().optional().default(""),
  RESEND_API_KEY: z.string().optional().default(""),
  BOOTSTRAP_ADMIN_ENABLED: booleanString.default(false),
  BOOTSTRAP_ADMIN_EMAIL: z.string().optional().default(""),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().optional().default(""),
  HIMALAYAS_ENABLED: booleanString.default(false),
  HIMALAYAS_API_URL: z.string().url().default("https://himalayas.app/jobs/api"),
  HIMALAYAS_PAGE_LIMIT: z.coerce.number().int().min(1).max(20).default(20),
  HIMALAYAS_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  HIMALAYAS_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  HIMALAYAS_INITIAL_BACKFILL_PAGES: z.coerce.number().int().positive().default(5),
  HIMALAYAS_INITIAL_BACKFILL_MAX_PAGES: z.coerce.number().int().positive().optional(),
  HIMALAYAS_RECURRING_SYNC_PAGES: z.coerce.number().int().positive().default(2),
  HIMALAYAS_SYNC_MAX_PAGES: z.coerce.number().int().positive().optional(),
  HIMALAYAS_UNCHANGED_STOP_THRESHOLD: z.coerce.number().int().positive().default(20),
  HIMALAYAS_RETRY_ATTEMPTS: z.coerce.number().int().min(0).optional(),
  HIMALAYAS_MAX_RETRIES: z.coerce.number().int().min(0).default(3),
  HIMALAYAS_RETRY_DELAY_MS: z.coerce.number().int().nonnegative().default(500),
  HIMALAYAS_RATE_LIMIT_DELAY_MS: z.coerce.number().int().nonnegative().default(1000),
  HIMALAYAS_REQUEST_DELAY_MS: z.coerce.number().int().nonnegative().default(3000),
  HIMALAYAS_CRON: z.string().min(1).default("0 3 * * *"),
  HIMALAYAS_LIVE_SMOKE: booleanString.default(false),
  HIMALAYAS_LIVE_SMOKE_PERSIST: booleanString.default(false),
  APITUBE_API_KEY: z.string().optional().default(""),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional().or(z.literal("")),
  SENTRY_DSN: z.string().url().optional().or(z.literal(""))
});

export type Env = z.infer<typeof envSchema>;
