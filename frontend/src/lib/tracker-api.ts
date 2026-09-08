import { authRequest } from "./auth-api";

export type ApplicationStage =
  | "SAVED"
  | "APPLIED"
  | "INTERVIEWING"
  | "OFFER"
  | "REJECTED"
  | "WITHDRAWN";

export type ApplicationLifecycle = "ACTIVE" | "ARCHIVED";

export interface ApplicationHistoryItem {
  id: string;
  fromStage: ApplicationStage | null;
  toStage: ApplicationStage;
  note: string | null;
  occurredAt: string;
}

export interface TrackedApplication {
  id: string;
  jobId: string | null;
  jobSlug: string | null;
  roleTitle: string;
  companyName: string | null;
  companyLogoUrl: string | null;
  providerName: string | null;
  applicationUrl: string | null;
  locationLabel: string | null;
  workMode: string | null;
  employerDeadlineAt: string | null;
  sourceUrl: string | null;
  sourceLabel: string | null;
  contactName: string | null;
  contactEmail: string | null;
  stage: ApplicationStage;
  lifecycle: ApplicationLifecycle;
  nextAction: string | null;
  nextActionAt: string | null;
  notes: string | null;
  appliedAt: string | null;
  reminderAt: string | null;
  interviewAt: string | null;
  revision: number;
  isJobExpired: boolean;
  createdAt: string;
  updatedAt: string;
  history: ApplicationHistoryItem[];
  alreadyTracked?: boolean;
}

export interface TrackerListResponse {
  data: TrackedApplication[];
  stageCounts: Record<ApplicationStage, number>;
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
  };
  totalCount: number;
}

export interface CreateApplicationPayload {
  jobSlug?: string;
  roleTitle?: string;
  companyName?: string;
  applicationUrl?: string;
  stage?: ApplicationStage;
  appliedAt?: string;
  nextAction?: string;
  nextActionAt?: string;
  notes?: string;
  reminderAt?: string;
  interviewAt?: string;
  sourceUrl?: string;
  sourceLabel?: string;
  contactName?: string;
  contactEmail?: string;
}

export interface UpdateApplicationPayload {
  expectedRevision: number;
  stage?: ApplicationStage;
  stageChangeNote?: string;
  roleTitle?: string;
  companyName?: string;
  applicationUrl?: string;
  nextAction?: string;
  nextActionAt?: string;
  notes?: string;
  appliedAt?: string;
  reminderAt?: string;
  interviewAt?: string;
  sourceUrl?: string;
  sourceLabel?: string;
  contactName?: string;
  contactEmail?: string;
  lifecycle?: ApplicationLifecycle;
}

export async function fetchApplications(params?: {
  stage?: ApplicationStage;
  lifecycle?: ApplicationLifecycle;
  cursor?: string;
  limit?: number;
}): Promise<TrackerListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.stage) searchParams.set("stage", params.stage);
  if (params?.lifecycle) searchParams.set("lifecycle", params.lifecycle);
  if (params?.cursor) searchParams.set("cursor", params.cursor);
  if (params?.limit) searchParams.set("limit", String(params.limit));

  const qs = searchParams.toString();
  return authRequest<TrackerListResponse>(`/tracker${qs ? `?${qs}` : ""}`);
}

export async function fetchApplicationById(id: string): Promise<TrackedApplication> {
  return authRequest<TrackedApplication>(`/tracker/${encodeURIComponent(id)}`);
}

export async function createApplication(payload: CreateApplicationPayload): Promise<TrackedApplication> {
  return authRequest<TrackedApplication>("/tracker", {
    method: "POST",
    csrf: true,
    body: payload
  });
}

export async function updateApplication(
  id: string,
  payload: UpdateApplicationPayload
): Promise<TrackedApplication> {
  return authRequest<TrackedApplication>(`/tracker/${encodeURIComponent(id)}`, {
    method: "PATCH",
    csrf: true,
    body: payload
  });
}

export async function archiveApplication(
  id: string,
  expectedRevision: number
): Promise<TrackedApplication> {
  return authRequest<TrackedApplication>(
    `/tracker/${encodeURIComponent(id)}/archive?expectedRevision=${expectedRevision}`,
    {
      method: "PATCH",
      csrf: true
    }
  );
}

export async function restoreApplication(
  id: string,
  expectedRevision: number
): Promise<TrackedApplication> {
  return authRequest<TrackedApplication>(
    `/tracker/${encodeURIComponent(id)}/restore?expectedRevision=${expectedRevision}`,
    {
      method: "PATCH",
      csrf: true
    }
  );
}

export async function deleteApplication(
  id: string,
  expectedRevision: number
): Promise<{ success: boolean; id: string }> {
  return authRequest<{ success: boolean; id: string }>(
    `/tracker/${encodeURIComponent(id)}?expectedRevision=${expectedRevision}`,
    {
      method: "DELETE",
      csrf: true
    }
  );
}
