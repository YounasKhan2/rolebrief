import { authRequest } from "../auth/auth-api";
import type { ApiJob } from "../core/api";

export interface SavedJobsResponse {
  data: (ApiJob & { savedAt?: string; status?: string; isExpired?: boolean })[];
  pageInfo?: {
    nextCursor: string | null;
    hasNextPage: boolean;
  };
  totalCount: number;
}

export interface SavedSlugsResponse {
  slugs: string[];
}

export interface SavedMutationResponse {
  success: boolean;
  saved: boolean;
  slug: string;
}

export async function fetchSavedJobSlugs(): Promise<string[]> {
  const response = await authRequest<SavedSlugsResponse>("/saved/jobs/slugs");
  return response?.slugs ?? [];
}

export async function fetchSavedJobs(params?: { cursor?: string; limit?: number }): Promise<SavedJobsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.cursor) searchParams.set("cursor", params.cursor);
  if (params?.limit) searchParams.set("limit", String(params.limit));
  const qs = searchParams.toString();
  return authRequest<SavedJobsResponse>(`/saved/jobs${qs ? `?${qs}` : ""}`);
}

export async function saveJob(slug: string): Promise<SavedMutationResponse> {
  return authRequest<SavedMutationResponse>(`/saved/jobs/${encodeURIComponent(slug)}`, {
    method: "POST",
    csrf: true
  });
}

export async function unsaveJob(slug: string): Promise<SavedMutationResponse> {
  return authRequest<SavedMutationResponse>(`/saved/jobs/${encodeURIComponent(slug)}`, {
    method: "DELETE",
    csrf: true
  });
}
