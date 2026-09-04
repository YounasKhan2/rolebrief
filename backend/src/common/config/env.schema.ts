import { z } from "zod";

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
  HIMALAYAS_ENABLED: z.coerce.boolean().default(false),
  APITUBE_API_KEY: z.string().optional().default(""),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional().or(z.literal("")),
  SENTRY_DSN: z.string().url().optional().or(z.literal(""))
});

export type Env = z.infer<typeof envSchema>;
