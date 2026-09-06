export const QUEUES = {
  ingestion: "ingestion",
  verification: "verification",
  enrichment: "enrichment",
  alerts: "alerts",
  delivery: "delivery"
} as const;

export const INGEST_HIMALAYAS_JOB = "providers.himalayas.ingest";
export const SEND_AUTH_EMAIL_JOB = "auth.email.send";
