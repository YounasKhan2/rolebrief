export type ApiErrorCode = "timeout" | "aborted" | "not_found" | "http" | "network" | "parse";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: ApiErrorCode,
    readonly status?: number,
    readonly retryAfterSeconds?: number,
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
  remoteRestrictions: {
    countryCodes?: string[];
    labels?: string[];
    timezones?: string[];
  } | null;
  remoteRestrictionsText: string | null;
  locations: ApiLocation[];
  salary: ApiSalary | null;
  descriptionHtml: string | null;
  excerpt: string | null;
  publishedAt: string | null;
  expiresAt: string | null;
  providerExpiresAt: string | null;
  applicationDeadlineAt: string | null;
  deadlineMetadata: unknown;
  applicationUrl: string | null;
  applyDomain: string | null;
  source: ApiSource | null;
}

export interface JobsListResponse {
  data: ApiJob[];
  pageInfo: {
    nextCursor: string | null;
    hasNextPage: boolean;
  };
  totalCount: number;
  appliedFilters: Record<string, unknown>;
}

export interface FacetItem {
  value: string;
  label: string;
  count: number;
}

export interface JobFacetsResponse {
  workMode: FacetItem[];
  remoteScope: FacetItem[];
  seniority: FacetItem[];
  employmentType: FacetItem[];
  country: FacetItem[];
  category: FacetItem[];
  provider: FacetItem[];
}

export interface ListJobsParams {
  q?: string | null;
  country?: string | string[] | null;
  remoteScope?: string | string[] | null;
  workMode?: string | string[] | null;
  timezone?: string | string[] | null;
  seniority?: string | string[] | null;
  employmentType?: string | string[] | null;
  category?: string | string[] | null;
  company?: string | string[] | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency?: string | null;
  publishedAfter?: string | null;
  deadlineBefore?: string | null;
  provider?: string | null;
  status?: string | null;
  sort?: string | null;
  cursor?: string | null;
  limit?: number;
  signal?: AbortSignal;
}

function resolveApiBaseUrl(): string {
  const envUrl = import.meta.env?.VITE_API_BASE_URL;
  if (typeof window !== "undefined" && window.location.hostname) {
    if (envUrl && (envUrl.includes("localhost") || envUrl.includes("127.0.0.1"))) {
      try {
        const u = new URL(envUrl);
        u.hostname = window.location.hostname;
        return u.toString().replace(/\/+$/, "");
      } catch {
        // fallback to default below
      }
    }
    return `http://${window.location.hostname}:3000/api/v1`;
  }
  return envUrl || "http://127.0.0.1:3000/api/v1";
}

const DEFAULT_TIMEOUT_MS = 8000;

export const API_BASE_URL = normalizeBaseUrl(resolveApiBaseUrl());

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

export async function requestJson<T>(
  path: string,
  options: { signal?: AbortSignal; timeoutMs?: number; method?: string; body?: unknown; headers?: Record<string, string>; credentials?: RequestCredentials } = {},
): Promise<T> {
  const controller = new AbortController();
  joinSignals(controller, options.signal);
  const timeout = window.setTimeout(() => controller.abort("timeout"), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: options.credentials,
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

export function listJobs(params: ListJobsParams = {}) {
  const search = new URLSearchParams();

  if (params.q) search.set("q", params.q.trim());
  if (params.country) {
    const val = Array.isArray(params.country) ? params.country.join(",") : params.country;
    if (val) search.set("country", val);
  }
  if (params.remoteScope) {
    const val = Array.isArray(params.remoteScope) ? params.remoteScope.join(",") : params.remoteScope;
    if (val) search.set("remoteScope", val);
  }
  if (params.workMode) {
    const val = Array.isArray(params.workMode) ? params.workMode.join(",") : params.workMode;
    if (val) search.set("workMode", val);
  }
  if (params.timezone) {
    const val = Array.isArray(params.timezone) ? params.timezone.join(",") : params.timezone;
    if (val) search.set("timezone", val);
  }
  if (params.seniority) {
    const val = Array.isArray(params.seniority) ? params.seniority.join(",") : params.seniority;
    if (val) search.set("seniority", val);
  }
  if (params.employmentType) {
    const val = Array.isArray(params.employmentType) ? params.employmentType.join(",") : params.employmentType;
    if (val) search.set("employmentType", val);
  }
  if (params.category) {
    const val = Array.isArray(params.category) ? params.category.join(",") : params.category;
    if (val) search.set("category", val);
  }
  if (params.company) {
    const val = Array.isArray(params.company) ? params.company.join(",") : params.company;
    if (val) search.set("company", val);
  }
  if (params.salaryMin != null) search.set("salaryMin", String(params.salaryMin));
  if (params.salaryMax != null) search.set("salaryMax", String(params.salaryMax));
  if (params.currency) search.set("currency", params.currency);
  if (params.publishedAfter) search.set("publishedAfter", params.publishedAfter);
  if (params.deadlineBefore) search.set("deadlineBefore", params.deadlineBefore);
  if (params.provider) search.set("provider", params.provider);
  if (params.status) search.set("status", params.status);
  if (params.sort) search.set("sort", params.sort);
  if (params.cursor) search.set("cursor", params.cursor);
  if (params.limit != null) search.set("limit", String(params.limit));

  const qs = search.toString();
  return requestJson<JobsListResponse>(`/jobs${qs ? `?${qs}` : ""}`, { signal: params.signal });
}

export function getJob(slug: string, params: { signal?: AbortSignal } = {}) {
  return requestJson<ApiJob>(`/jobs/${encodeURIComponent(slug)}`, { signal: params.signal });
}

export function getRelatedJobs(slug: string, limit = 6, params: { signal?: AbortSignal } = {}) {
  return requestJson<ApiJob[]>(`/jobs/${encodeURIComponent(slug)}/related?limit=${limit}`, { signal: params.signal });
}

export function getJobFacets(params: Partial<ListJobsParams> = {}) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q.trim());
  if (params.country) {
    const val = Array.isArray(params.country) ? params.country.join(",") : params.country;
    if (val) search.set("country", val);
  }
  if (params.workMode) {
    const val = Array.isArray(params.workMode) ? params.workMode.join(",") : params.workMode;
    if (val) search.set("workMode", val);
  }
  if (params.seniority) {
    const val = Array.isArray(params.seniority) ? params.seniority.join(",") : params.seniority;
    if (val) search.set("seniority", val);
  }
  if (params.category) {
    const val = Array.isArray(params.category) ? params.category.join(",") : params.category;
    if (val) search.set("category", val);
  }

  const qs = search.toString();
  return requestJson<JobFacetsResponse>(`/jobs/facets${qs ? `?${qs}` : ""}`, { signal: params.signal });
}
