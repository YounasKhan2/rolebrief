export type ApiErrorCode = "timeout" | "aborted" | "not_found" | "http" | "network" | "parse";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: ApiErrorCode,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiCompany {
  slug: string;
  name: string;
  logoUrl: string | null;
}

export interface ApiLocation {
  alpha2: string | null;
  name: string;
  slug: string;
}

export interface ApiSalary {
  min: string | number | null;
  max: string | number | null;
  currency: string | null;
  period: string | null;
}

export interface ApiSource {
  name: string;
  url: string;
  attributionPolicy: string;
}

export interface ApiJob {
  id: string;
  slug: string;
  title: string;
  company: ApiCompany | null;
  employmentType: string | null;
  seniority: string | null;
  workMode: string | null;
  remoteScope: string | null;
  remoteRestrictions: unknown;
  remoteRestrictionsText: string | null;
  locations: ApiLocation[];
  salary: ApiSalary | null;
  descriptionHtml: string | null;
  excerpt: string | null;
  publishedAt: string | null;
  expiresAt: string | null;
  applicationUrl: string | null;
  applyDomain: string | null;
  source: ApiSource | null;
}

export interface JobsListResponse {
  data: ApiJob[];
  pageInfo: { nextCursor: string | null };
  freshness: { servedFromStoredData: boolean };
}

const DEFAULT_API_BASE_URL = "http://127.0.0.1:3000/api/v1";
const DEFAULT_TIMEOUT_MS = 8000;

export const API_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL);

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

function joinSignals(controller: AbortController, signal?: AbortSignal) {
  if (!signal) return;
  if (signal.aborted) {
    controller.abort(signal.reason);
    return;
  }
  signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
}

async function requestJson<T>(
  path: string,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<T> {
  const controller = new AbortController();
  joinSignals(controller, options.signal);
  const timeout = window.setTimeout(() => controller.abort("timeout"), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 404) throw new ApiError("The requested job was not found.", "not_found", 404);
      throw new ApiError(`The jobs API returned ${response.status}.`, "http", response.status);
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new ApiError("The jobs API returned invalid JSON.", "parse", response.status);
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) {
      const code = controller.signal.reason === "timeout" ? "timeout" : "aborted";
      throw new ApiError(code === "timeout" ? "The jobs API timed out." : "The request was cancelled.", code);
    }
    throw new ApiError("Could not reach the jobs API.", "network");
  } finally {
    window.clearTimeout(timeout);
  }
}

export function listJobs(params: { cursor?: string | null; limit?: number; signal?: AbortSignal } = {}) {
  const search = new URLSearchParams();
  if (params.cursor) search.set("cursor", params.cursor);
  if (params.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  return requestJson<JobsListResponse>(`/jobs${qs ? `?${qs}` : ""}`, { signal: params.signal });
}

export function getJob(slug: string, params: { signal?: AbortSignal } = {}) {
  return requestJson<ApiJob>(`/jobs/${encodeURIComponent(slug)}`, { signal: params.signal });
}
