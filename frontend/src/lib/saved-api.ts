import { authRequest } from "./auth-api";
import type { ApiJob } from "./api";

export interface SavedJobsResponse {
  data: (ApiJob & { savedAt?: string })[];
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

export async function fetchSavedJobs(): Promise<SavedJobsResponse> {
  return authRequest<SavedJobsResponse>("/saved/jobs");
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
