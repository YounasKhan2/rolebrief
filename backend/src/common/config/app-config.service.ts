import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Env } from "./env.schema";

@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get nodeEnv() {
    return this.config.get("NODE_ENV", { infer: true });
  }

  get port() {
    return this.config.get("PORT", { infer: true });
  }

  get logLevel() {
    return this.config.get("LOG_LEVEL", { infer: true });
  }

  get frontendOrigins() {
    return this.config
      .get("FRONTEND_ORIGIN", { infer: true })
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  get publicAppUrl() {
    return this.config.get("PUBLIC_APP_URL", { infer: true }) || this.frontendOrigins[0] || "http://localhost:3000";
  }

  get databaseUrl() {
    return this.config.get("DATABASE_URL", { infer: true });
  }

  get redisUrl() {
    return this.config.get("REDIS_URL", { infer: true });
  }

  get cursorSigningSecret() {
    return this.config.get("CURSOR_SIGNING_SECRET", { infer: true }) || this.config.get("SESSION_SECRET", { infer: true });
  }

  get auth() {
    return {
      sessionSecret: this.config.get("SESSION_SECRET", { infer: true }),
      accessTokenTtlSeconds: this.config.get("ACCESS_TOKEN_TTL", { infer: true }),
      refreshSessionTtlSeconds: this.config.get("REFRESH_SESSION_TTL", { infer: true }),
      cookieSecure: this.config.get("COOKIE_SECURE", { infer: true }),
      cookieSameSite: this.config.get("COOKIE_SAME_SITE", { infer: true }),
      frontendOrigin: this.frontendOrigins[0],
      rateLimits: {
        login: this.config.get("AUTH_RATE_LIMIT_LOGIN", { infer: true }),
        signup: this.config.get("AUTH_RATE_LIMIT_SIGNUP", { infer: true }),
        recovery: this.config.get("AUTH_RATE_LIMIT_RECOVERY", { infer: true }),
        refresh: this.config.get("AUTH_RATE_LIMIT_REFRESH", { infer: true })
      },
      trackerRateLimits: {
        read: this.config.get("TRACKER_RATE_LIMIT_READ", { infer: true }),
        mutate: this.config.get("TRACKER_RATE_LIMIT_MUTATE", { infer: true }),
        delete: this.config.get("TRACKER_RATE_LIMIT_DELETE", { infer: true })
      },
      rateLimitFailClosed: this.config.get("RATE_LIMIT_FAIL_CLOSED", { infer: true }),
      bootstrap: {
        enabled: this.config.get("BOOTSTRAP_ADMIN_ENABLED", { infer: true }),
        email: this.config.get("BOOTSTRAP_ADMIN_EMAIL", { infer: true }),
        password: this.config.get("BOOTSTRAP_ADMIN_PASSWORD", { infer: true })
      },
      email: {
        provider: this.config.get("EMAIL_PROVIDER", { infer: true }),
        deliveryEnabled: this.config.get("EMAIL_DELIVERY_ENABLED", { infer: true }),
        from: this.config.get("RESEND_FROM_EMAIL", { infer: true }) || this.config.get("EMAIL_FROM", { infer: true }),
        replyTo: this.config.get("RESEND_REPLY_TO", { infer: true }),
        exposeDevLinks: this.config.get("EMAIL_EXPOSE_DEV_LINKS", { infer: true }),
        smtpUrl: this.config.get("SMTP_URL", { infer: true }),
        resendApiKey: this.config.get("RESEND_API_KEY", { infer: true })
      }
    };
  }

  get queuePrefix() {
    return this.config.get("QUEUE_PREFIX", { infer: true });
  }

  get workerConcurrency() {
    return this.config.get("WORKER_CONCURRENCY", { infer: true });
  }

  get himalayas() {
    return {
      enabled: this.config.get("HIMALAYAS_ENABLED", { infer: true }),
      apiUrl: this.config.get("HIMALAYAS_API_URL", { infer: true }),
      pageLimit: this.config.get("HIMALAYAS_PAGE_LIMIT", { infer: true }),
      timeoutMs: this.config.get("HIMALAYAS_TIMEOUT_MS", { infer: true }) ?? this.config.get("HIMALAYAS_REQUEST_TIMEOUT_MS", { infer: true }),
      initialBackfillPages: this.config.get("HIMALAYAS_INITIAL_BACKFILL_MAX_PAGES", { infer: true }) ?? this.config.get("HIMALAYAS_INITIAL_BACKFILL_PAGES", { infer: true }),
      recurringSyncPages: this.config.get("HIMALAYAS_SYNC_MAX_PAGES", { infer: true }) ?? this.config.get("HIMALAYAS_RECURRING_SYNC_PAGES", { infer: true }),
      unchangedStopThreshold: this.config.get("HIMALAYAS_UNCHANGED_STOP_THRESHOLD", { infer: true }),
      retryAttempts: this.config.get("HIMALAYAS_RETRY_ATTEMPTS", { infer: true }) ?? this.config.get("HIMALAYAS_MAX_RETRIES", { infer: true }),
      retryDelayMs: this.config.get("HIMALAYAS_RETRY_DELAY_MS", { infer: true }),
      rateLimitDelayMs: this.config.get("HIMALAYAS_RATE_LIMIT_DELAY_MS", { infer: true }),
      requestDelayMs: this.config.get("HIMALAYAS_REQUEST_DELAY_MS", { infer: true }),
      cron: this.config.get("HIMALAYAS_CRON", { infer: true }),
      liveSmoke: this.config.get("HIMALAYAS_LIVE_SMOKE", { infer: true }),
      liveSmokePersist: this.config.get("HIMALAYAS_LIVE_SMOKE_PERSIST", { infer: true })
    };
  }

  get resumes() {
    return {
      storage: {
        endpoint: this.config.get("RESUME_STORAGE_ENDPOINT", { infer: true }),
        publicEndpoint: this.config.get("RESUME_STORAGE_PUBLIC_ENDPOINT", { infer: true }) || this.config.get("RESUME_STORAGE_ENDPOINT", { infer: true }),
        region: this.config.get("RESUME_STORAGE_REGION", { infer: true }),
        bucket: this.config.get("RESUME_STORAGE_BUCKET", { infer: true }),
        accessKeyId: this.config.get("RESUME_STORAGE_ACCESS_KEY_ID", { infer: true }),
        secretAccessKey: this.config.get("RESUME_STORAGE_SECRET_ACCESS_KEY", { infer: true }),
        forcePathStyle: this.config.get("RESUME_STORAGE_FORCE_PATH_STYLE", { infer: true })
      },
      upload: {
        maxBytes: this.config.get("RESUME_UPLOAD_MAX_BYTES", { infer: true }),
        urlTtlSeconds: this.config.get("RESUME_UPLOAD_URL_TTL_SECONDS", { infer: true })
      },
      rateLimits: {
        uploadSession: this.config.get("RESUME_RATE_LIMIT_UPLOAD_SESSION", { infer: true }),
        confirmUpload: this.config.get("RESUME_RATE_LIMIT_CONFIRM_UPLOAD", { infer: true })
      },
      processing: {
        maxAttempts: this.config.get("RESUME_PROCESSING_MAX_ATTEMPTS", { infer: true }),
        leaseSeconds: this.config.get("RESUME_PROCESSING_LEASE_SECONDS", { infer: true }),
        timeoutMs: this.config.get("RESUME_PROCESSING_TIMEOUT_MS", { infer: true }),
        pdfMaxPages: this.config.get("RESUME_PDF_MAX_PAGES", { infer: true }),
        docxMaxEntries: this.config.get("RESUME_DOCX_MAX_ENTRIES", { infer: true }),
        docxMaxUncompressedBytes: this.config.get("RESUME_DOCX_MAX_UNCOMPRESSED_BYTES", { infer: true }),
        docxMaxEntryBytes: this.config.get("RESUME_DOCX_MAX_ENTRY_BYTES", { infer: true }),
        docxMaxCompressionRatio: this.config.get("RESUME_DOCX_MAX_COMPRESSION_RATIO", { infer: true })
      },
      scanning: {
        host: this.config.get("CLAMAV_HOST", { infer: true }),
        port: this.config.get("CLAMAV_PORT", { infer: true }),
        timeoutMs: this.config.get("CLAMAV_SCAN_TIMEOUT_MS", { infer: true })
      }
    };
  }
}
