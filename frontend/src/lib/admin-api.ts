import { authRequest } from "./auth-api";
export type { AdminUser, AuthRole, AuthStatus } from "./auth-api";

export interface AdminMetrics {
  users: {
    total: number;
    active: number;
    locked: number;
    disabled: number;
  };
  jobs: {
    total: number;
    active: number;
    stale: number;
    expired: number;
    suspicious: number;
    flagged: number;
    pendingModeration: number;
  };
  ingestion: {
    runsLast24h: number;
    failedRunsLast24h: number;
    recordsCreatedLast24h: number;
    recordsUpdatedLast24h: number;
  };
  pipelines: {
    outboxPending: number;
    outboxFailed: number;
    emailQueued: number;
    emailFailed: number;
    alertsActive: number;
  };
}

export interface AdminSourceItem {
  id: string;
  name: string;
  kind: string;
  region: string;
  status: "healthy" | "degraded" | "down";
  enabled: boolean;
  cronSchedule: string | null;
  lastRun: {
    id: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    recordsFetched: number;
    recordsCreated: number;
    recordsUpdated: number;
    recordsExpired: number;
    stopReason: string | null;
  } | null;
  checkpoint: {
    mode: string;
    updatedAt: string;
    cursor: string | null;
  } | null;
  stats24h: {
    runs: number;
    failures: number;
    recordsCreated: number;
  };
}

export interface ModerationQueueItem {
  id: string;
  slug: string;
  title: string;
  status: string;
  moderationState: string;
  severity: "high" | "medium";
  reason: string;
  company: string;
  companySlug: string | null;
  companyLogoUrl: string | null;
  provider: string;
  location: string;
  listingUrl: string | null;
  applicationUrl: string | null;
  discoveredAt: string;
  publishedAt: string | null;
  expiresAt: string | null;
}

export interface ModerationQueueResult {
  items: ModerationQueueItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

export function getAdminMetrics(): Promise<AdminMetrics> {
  return authRequest<AdminMetrics>("/admin/metrics");
}

export function getAdminSources(): Promise<{ sources: AdminSourceItem[] }> {
  return authRequest<{ sources: AdminSourceItem[] }>('/admin/sources');
}

export function triggerSourceSync(providerId: string) {
  return authRequest<{ queued: boolean; jobId: string; providerId: string; enqueuedAt: string }>(
    `/admin/sources/${encodeURIComponent(providerId)}/sync`,
    { method: "POST", csrf: true }
  );
}

export function getModerationQueue(params: { tab?: string; cursor?: string; limit?: number } = {}): Promise<ModerationQueueResult> {
  const sp = new URLSearchParams();
  if (params.tab) sp.set("tab", params.tab);
  if (params.cursor) sp.set("cursor", params.cursor);
  if (params.limit) sp.set("limit", String(params.limit));
  const query = sp.toString();
  return authRequest<ModerationQueueResult>(`/admin/moderation/queue${query ? "?" + query : ""}`);
}

export function executeModerationAction(
  jobId: string,
  action: "APPROVE" | "EXPIRE" | "DISMISS" | "REMOVE",
  notes?: string
) {
  return authRequest<{ success: boolean; job: { id: string; slug: string; status: string; moderationState: string }; action: string }>(
    `/admin/moderation/${encodeURIComponent(jobId)}/action`,
    { method: "POST", body: { action, notes }, csrf: true }
  );
}
