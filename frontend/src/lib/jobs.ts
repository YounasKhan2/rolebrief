import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, getJob as getApiJob, getRelatedJobs, listJobs, type ApiJob, type ListJobsParams } from "./api";
import { domainFromUrl } from "./format";

export type EligibilityState = "eligible" | "check" | "conflict" | "unknown";
export type RemoteEligibility =
  | "worldwide"
  | "country-eligible"
  | "region-limited"
  | "on-site"
  | "hybrid"
  | "unknown";
export type WorkModel = "Remote" | "Hybrid" | "On-site";

export interface MatchDimension {
  label: string;
  score: number;
  note: string;
}

export interface MatchBriefData {
  score: number;
  dimensions: MatchDimension[];
  evidence: string[];
  missing: string[];
  ambiguous: string[];
  suggestions: string[];
}

export interface FreshnessEvent {
  kind: "published" | "discovered" | "verified" | "updated" | "rechecked" | "deadline" | "provider-expiry" | "expired";
  at: string;
  note?: string;
}

export interface Job {
  slug: string;
  title: string;
  companySlug: string;
  companyName: string;
  companyLogoUrl: string | null;
  locations: string[];
  workModel: WorkModel;
  remoteEligibility: RemoteEligibility;
  remoteRestrictionsText: string;
  seniority: string;
  employmentType: string;
  discipline: string;
  skills: string[];
  salary: { text: string; provided: boolean } | null;
  source: string;
  sourceUrl: string;
  applyUrl: string;
  applyDomain: string;
  freshness: FreshnessEvent[];
  eligibility: {
    state: EligibilityState;
    reasons: { label: string; kind: EligibilityState }[];
  };
  match: MatchBriefData;
  reasons: string[];
  description: {
    overview: string;
    html: string | null;
    responsibilities: string[];
    required: string[];
    preferred: string[];
    benefits: string[];
    workAuthorization: string;
  };
  flags?: ("expired" | "suspicious" | "missing-data")[];
}

export interface UseJobsOptions {
  q?: string;
  disc?: Set<string> | string[];
  remote?: Set<string> | string[];
  senior?: Set<string> | string[];
  workMode?: Set<string> | string[];
  country?: Set<string> | string[];
  salaryOnly?: boolean;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  sort?: string;
  limit?: number;
}

export interface JobsState {
  data: Job[];
  totalCount: number;
  loading: boolean;
  loadingMore: boolean;
  hasNextPage: boolean;
  nextCursor: string | null;
  error: ApiError | null;
  loadMore: () => void;
  retry: () => void;
}

export interface JobState {
  data: Job | null;
  loading: boolean;
  error: ApiError | null;
  notFound: boolean;
  retry: () => void;
}

export const disciplines = [
  "Full-stack",
  "Frontend",
  "Backend",
  "Mobile",
  "DevOps/Cloud",
  "QA/Testing",
  "UI/UX",
  "Data",
  "AI/ML",
  "Other",
];

const notCalculated: MatchBriefData = {
  score: 0,
  dimensions: [],
  evidence: [],
  missing: [],
  ambiguous: ["Not calculated. Profile-based matching is not connected to the backend yet."],
  suggestions: ["Profile required to calculate a RoleBrief match score."],
};

export function normalizeFilterList(val: Set<string> | string[] | undefined): string[] {
  if (!val) return [];
  const raw = val instanceof Set ? Array.from(val) : Array.isArray(val) ? val : [];
  const cleaned = raw
    .map((s) => (typeof s === "string" ? s.trim() : String(s)))
    .filter(Boolean);
  return Array.from(new Set(cleaned)).sort();
}

export function buildCanonicalQueryKey(options: UseJobsOptions = {}): {
  canonicalQueryKey: string;
  queryParams: ListJobsParams;
} {
  const normQ = (options.q ?? "").trim();
  const normSort = options.sort ?? "newest";
  const normLimit = options.limit ?? 20;
  const normSalaryOnly = Boolean(options.salaryOnly);
  const normSalaryMin = options.salaryMin != null ? Number(options.salaryMin) : (normSalaryOnly ? 1 : null);
  const normSalaryMax = options.salaryMax != null ? Number(options.salaryMax) : null;
  const normCurrency = options.currency ? options.currency.trim().toUpperCase() : null;

  const discList = normalizeFilterList(options.disc);
  const remoteList = normalizeFilterList(options.remote);
  const seniorList = normalizeFilterList(options.senior);
  const workModeList = normalizeFilterList(options.workMode);
  const countryList = normalizeFilterList(options.country);

  const canonicalQueryKey = [
    `q:${normQ}`,
    `sort:${normSort}`,
    `limit:${normLimit}`,
    `disc:${discList.join("|")}`,
    `remote:${remoteList.join("|")}`,
    `senior:${seniorList.join("|")}`,
    `workMode:${workModeList.join("|")}`,
    `country:${countryList.join("|")}`,
    `salOnly:${normSalaryOnly}`,
    `salMin:${normSalaryMin ?? ""}`,
    `salMax:${normSalaryMax ?? ""}`,
    `curr:${normCurrency ?? ""}`
  ].join("&");

  const queryParams: ListJobsParams = {
    limit: normLimit,
    sort: normSort,
  };

  if (normQ) queryParams.q = normQ;
  if (discList.length > 0) queryParams.category = discList;
  if (seniorList.length > 0) queryParams.seniority = seniorList;
  if (countryList.length > 0) queryParams.country = countryList;
  if (workModeList.length > 0) queryParams.workMode = workModeList;

  if (remoteList.length > 0) {
    const mappedWorkModes: string[] = [];
    const mappedScopes: string[] = [];

    for (const r of remoteList) {
      if (r === "worldwide") mappedScopes.push("WORLDWIDE");
      else if (r === "country-eligible") mappedScopes.push("COUNTRY_LIMITED", "COUNTRY_AND_TIMEZONE_LIMITED");
      else if (r === "region-limited") mappedScopes.push("TIMEZONE_LIMITED");
      else if (r === "on-site") mappedWorkModes.push("ONSITE");
      else if (r === "hybrid") mappedWorkModes.push("HYBRID");
    }

    if (mappedWorkModes.length > 0 && !queryParams.workMode) {
      queryParams.workMode = mappedWorkModes;
    }
    if (mappedScopes.length > 0) {
      queryParams.remoteScope = mappedScopes;
    }
  }

  if (normSalaryMin != null) queryParams.salaryMin = normSalaryMin;
  if (normSalaryMax != null) queryParams.salaryMax = normSalaryMax;
  if (normCurrency) queryParams.currency = normCurrency;

  return { canonicalQueryKey, queryParams };
}

export function useJobs(options: UseJobsOptions = {}): JobsState {
  const [data, setData] = useState<Job[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [version, setVersion] = useState(0);

  // 1. Derive canonical primitive query key and parameters from normalized scalars/arrays
  const { canonicalQueryKey, queryParams } = useMemo(
    () => buildCanonicalQueryKey(options),
    [
      options.q,
      options.sort,
      options.limit,
      options.salaryOnly,
      options.salaryMin,
      options.salaryMax,
      options.currency,
      options.disc instanceof Set ? Array.from(options.disc).sort().join(",") : Array.isArray(options.disc) ? options.disc.join(",") : options.disc,
      options.remote instanceof Set ? Array.from(options.remote).sort().join(",") : Array.isArray(options.remote) ? options.remote.join(",") : options.remote,
      options.senior instanceof Set ? Array.from(options.senior).sort().join(",") : Array.isArray(options.senior) ? options.senior.join(",") : options.senior,
      options.workMode instanceof Set ? Array.from(options.workMode).sort().join(",") : Array.isArray(options.workMode) ? options.workMode.join(",") : options.workMode,
      options.country instanceof Set ? Array.from(options.country).sort().join(",") : Array.isArray(options.country) ? options.country.join(",") : options.country,
    ]
  );

  // 2. Request State Machine Refs
  const activeRequestId = useRef(0);
  const activeQueryKeyRef = useRef<string>("");
  const inFlightCursorsRef = useRef<Set<string>>(new Set());
  const consumedCursorsRef = useRef<Set<string>>(new Set());
  const currentCursorRef = useRef<string | null>(null);
  const hasNextPageRef = useRef(false);

  // 3. Initial fetch / query change fetch: strictly depends on canonicalQueryKey and version
  useEffect(() => {
    const isNewQuery = activeQueryKeyRef.current !== canonicalQueryKey;
    if (isNewQuery) {
      activeQueryKeyRef.current = canonicalQueryKey;
      inFlightCursorsRef.current.clear();
      consumedCursorsRef.current.clear();
      currentCursorRef.current = null;
      hasNextPageRef.current = false;
      setData([]);
      setTotalCount(0);
      setNextCursor(null);
      setHasNextPage(false);
    }

    const requestId = ++activeRequestId.current;
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    listJobs({ ...queryParams, cursor: undefined, signal: controller.signal })
      .then((response) => {
        if (requestId !== activeRequestId.current || activeQueryKeyRef.current !== canonicalQueryKey) return;
        setData(response.data.map(mapApiJob));
        setTotalCount(response.totalCount);
        setNextCursor(response.pageInfo.nextCursor);
        currentCursorRef.current = response.pageInfo.nextCursor;
        setHasNextPage(response.pageInfo.hasNextPage);
        hasNextPageRef.current = response.pageInfo.hasNextPage;
      })
      .catch((err) => {
        if (requestId !== activeRequestId.current || controller.signal.aborted) return;
        if (err instanceof ApiError && err.code === "aborted") return;
        setError(err instanceof ApiError ? err : new ApiError("Could not load jobs.", "network"));
      })
      .finally(() => {
        if (requestId === activeRequestId.current && !controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [canonicalQueryKey, version]);

  // 4. Load more next batch handler
  const loadMore = useCallback(() => {
    const cursor = currentCursorRef.current;
    if (!cursor || !hasNextPageRef.current || loadingMore || loading) return;

    // Never request the same query+cursor concurrently or twice
    if (inFlightCursorsRef.current.has(cursor) || consumedCursorsRef.current.has(cursor)) return;

    const requestQueryKey = activeQueryKeyRef.current;
    const controller = new AbortController();

    inFlightCursorsRef.current.add(cursor);
    setLoadingMore(true);

    listJobs({ ...queryParams, cursor, signal: controller.signal })
      .then((response) => {
        if (activeQueryKeyRef.current !== requestQueryKey) return;
        consumedCursorsRef.current.add(cursor);

        setData((prev) => {
          const existingSlugs = new Set(prev.map((j) => j.slug));
          const newItems = response.data.map(mapApiJob).filter((j) => !existingSlugs.has(j.slug));
          return [...prev, ...newItems];
        });
        setTotalCount(response.totalCount);
        setNextCursor(response.pageInfo.nextCursor);
        currentCursorRef.current = response.pageInfo.nextCursor;
        setHasNextPage(response.pageInfo.hasNextPage);
        hasNextPageRef.current = response.pageInfo.hasNextPage;
      })
      .catch((err) => {
        if (activeQueryKeyRef.current !== requestQueryKey) return;
        if (controller.signal.aborted || (err instanceof ApiError && err.code === "aborted")) return;
        setError(err instanceof ApiError ? err : new ApiError("Could not load more jobs.", "network"));
      })
      .finally(() => {
        inFlightCursorsRef.current.delete(cursor);
        setLoadingMore(false);
      });
  }, [loading, loadingMore, queryParams]);

  const retry = useCallback(() => setVersion((v) => v + 1), []);

  return {
    data,
    totalCount,
    loading,
    loadingMore,
    hasNextPage,
    nextCursor,
    error,
    loadMore,
    retry,
  };
}

export function useJob(slug: string | undefined): JobState {
  const [data, setData] = useState<Job | null>(null);
  const [loading, setLoading] = useState(Boolean(slug));
  const [error, setError] = useState<ApiError | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!slug) {
      setData(null);
      setLoading(false);
      setError(new ApiError("The requested job was not found.", "not_found", 404));
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    getApiJob(slug, { signal: controller.signal })
      .then((response) => setData(mapApiJob(response)))
      .catch((err) => {
        if (err instanceof ApiError && err.code === "aborted") return;
        setData(null);
        setError(err instanceof ApiError ? err : new ApiError("Could not load the job.", "network"));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [slug, version]);

  const retry = useCallback(() => setVersion((v) => v + 1), []);
  return { data, loading, error, notFound: error?.code === "not_found", retry };
}

export function useSimilarJobs(job: Job | null, limit = 6) {
  const [data, setData] = useState<Job[]>([]);
  const [loading, setLoading] = useState(Boolean(job?.slug));
  const [error, setError] = useState<ApiError | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!job?.slug) {
      setData([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    getRelatedJobs(job.slug, limit, { signal: controller.signal })
      .then((jobs) => {
        setData(jobs.map(mapApiJob));
      })
      .catch((err) => {
        if (err instanceof ApiError && err.code === "aborted") return;
        setError(err instanceof ApiError ? err : new ApiError("Could not load related jobs.", "network"));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [job?.slug, limit, version]);

  const retry = useCallback(() => setVersion((v) => v + 1), []);
  return { data, loading, error, retry };
}

export function companyName(jobOrSlug: Job | string): string {
  return typeof jobOrSlug === "string" ? jobOrSlug : jobOrSlug.companyName;
}

export function mapApiJob(job: ApiJob): Job {
  const sourceUrl = job.source?.url || "";
  const applicationUrl = job.applicationUrl || sourceUrl;
  const companyName = nonEmpty(job.company?.name) ?? "Unknown company";
  const publishedAt = job.publishedAt ?? new Date().toISOString();
  const providerExpired = job.providerExpiresAt ? new Date(job.providerExpiresAt).getTime() < Date.now() : false;
  const applicationDeadlinePassed = job.applicationDeadlineAt ? new Date(job.applicationDeadlineAt).getTime() < Date.now() : false;
  const expired = job.expiresAt ? new Date(job.expiresAt).getTime() < Date.now() : providerExpired || applicationDeadlinePassed;
  const sourceDomain = sourceUrl ? domainFromUrl(sourceUrl) : "source unavailable";
  const applyDomain = job.applyDomain || domainFromUrl(applicationUrl);
  const workModel = mapWorkMode(job.workMode);
  const remoteEligibility = mapRemoteEligibility(job.workMode, job.remoteScope);
  const descriptionHtml = job.descriptionHtml ? sanitizeHtml(job.descriptionHtml) : null;
  const overview = nonEmpty(job.excerpt ? stripHtml(job.excerpt) : (descriptionHtml ? stripHtml(descriptionHtml) : "")) ?? "No description summary is available yet.";

  const freshnessEvents: FreshnessEvent[] = [
    { kind: "published", at: publishedAt, note: "Provider timestamp" },
    { kind: "discovered", at: publishedAt, note: "Stored from Himalayas provider" },
  ];

  if (job.applicationDeadlineAt) {
    freshnessEvents.push({
      kind: applicationDeadlinePassed ? "expired" : "deadline",
      at: job.applicationDeadlineAt,
      note: applicationDeadlinePassed ? "Deadline passed" : "Apply by",
    });
  }

  if (job.providerExpiresAt) {
    freshnessEvents.push({
      kind: providerExpired ? "expired" : "provider-expiry",
      at: job.providerExpiresAt,
      note: providerExpired ? "Expired listing" : "Provider expiry",
    });
  }

  const remoteRestrictionsText = job.remoteRestrictionsText || formatRemoteText(workModel, job.locations, job.remoteScope);

  return {
    slug: job.slug,
    title: nonEmpty(job.title) ?? "Untitled role",
    companySlug: job.company?.slug ?? "unknown-company",
    companyName,
    companyLogoUrl: job.company?.logoUrl ?? null,
    locations: job.locations.map((loc) => loc.name).filter(Boolean),
    workModel,
    remoteEligibility,
    remoteRestrictionsText,
    seniority: nonEmpty(job.seniority) ?? "Unknown",
    employmentType: nonEmpty(job.employmentType) ?? "Unknown",
    discipline: inferDiscipline(job.title, job.excerpt),
    skills: [],
    salary: mapSalary(job.salary),
    source: job.source?.name ?? "Himalayas",
    sourceUrl: sourceUrl || "https://himalayas.app/jobs",
    applyUrl: applicationUrl || "https://himalayas.app/jobs",
    applyDomain,
    freshness: freshnessEvents,
    eligibility: {
      state: "check",
      reasons: [
        { label: "Check required. Eligibility rules are verified against employer requirements.", kind: "check" },
        { label: remoteRestrictionsText, kind: "unknown" },
      ],
    },
    match: notCalculated,
    reasons: [
      `Source-linked: ${sourceDomain}`,
      "Profile required for match score",
      "Company momentum unavailable",
    ],
    description: {
      overview,
      html: descriptionHtml,
      responsibilities: [],
      required: [],
      preferred: [],
      benefits: [],
      workAuthorization: "Unavailable from provider. Confirm work authorization with the employer before applying.",
    },
    flags: [
      ...(expired ? ["expired" as const] : []),
      ...(!job.descriptionHtml && !job.excerpt ? ["missing-data" as const] : []),
    ],
  };
}

function mapWorkMode(value: string | null): WorkModel {
  const normalized = value?.toUpperCase() ?? "";
  if (normalized.includes("HYBRID")) return "Hybrid";
  if (normalized.includes("ONSITE") || normalized.includes("OFFICE")) return "On-site";
  return "Remote";
}

function mapRemoteEligibility(workMode: string | null, remoteScope: string | null): RemoteEligibility {
  const wm = workMode?.toUpperCase() ?? "";
  const rs = remoteScope?.toUpperCase() ?? "";

  if (wm.includes("HYBRID")) return "hybrid";
  if (wm.includes("ONSITE")) return "on-site";
  if (rs === "WORLDWIDE") return "worldwide";
  if (rs === "COUNTRY_LIMITED" || rs === "COUNTRY_AND_TIMEZONE_LIMITED") return "country-eligible";
  if (rs === "TIMEZONE_LIMITED") return "region-limited";
  return "unknown";
}

function formatRemoteText(workModel: WorkModel, locations: ApiJob["locations"], remoteScope: string | null): string {
  if (workModel === "On-site") {
    return locations.length > 0 ? `On-site · ${locations.map((l) => l.name).join(", ")}` : "On-site";
  }
  if (workModel === "Hybrid") {
    return locations.length > 0 ? `Hybrid · ${locations.map((l) => l.name).join(", ")}` : "Hybrid";
  }
  if (remoteScope === "WORLDWIDE") {
    return "Remote · Worldwide";
  }
  if (locations.length === 1) {
    return `Remote · ${locations[0].name} only`;
  }
  if (locations.length > 1) {
    return `Remote · ${locations.map((l) => l.name).join(", ")}`;
  }
  return "Remote · Location requirements unclear";
}

function mapSalary(salary: ApiJob["salary"]): Job["salary"] {
  if (!salary || (salary.min == null && salary.max == null)) return null;
  const min = salary.min == null ? "" : Number(salary.min).toLocaleString();
  const max = salary.max == null ? "" : Number(salary.max).toLocaleString();
  const range = [min, max].filter(Boolean).join("–");
  if (!range) return null;
  const curr = salary.currency || "$";
  const period = salary.period ? ` / ${salary.period.toLowerCase()}` : "";
  return { text: `${curr} ${range}${period}`, provided: true };
}

function inferDiscipline(title: string | null, excerpt: string | null) {
  const haystack = `${title ?? ""} ${excerpt ?? ""}`.toLowerCase();
  if (/(frontend|front-end|react|vue|angular)/.test(haystack)) return "Frontend";
  if (/(backend|back-end|node|api|platform)/.test(haystack)) return "Backend";
  if (/(mobile|ios|android|flutter|react native)/.test(haystack)) return "Mobile";
  if (/(devops|cloud|sre|infrastructure|kubernetes)/.test(haystack)) return "DevOps/Cloud";
  if (/(qa|test|quality)/.test(haystack)) return "QA/Testing";
  if (/(designer|design|ux|ui)/.test(haystack)) return "UI/UX";
  if (/(data|analytics|warehouse|etl)/.test(haystack)) return "Data";
  if (/(machine learning|ml|ai|llm)/.test(haystack)) return "AI/ML";
  if (/(full.?stack)/.test(haystack)) return "Full-stack";
  return "Other";
}

function sanitizeHtml(html: string | null): string | null {
  if (!html) return null;
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?>[\s\S]*?<\/embed>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/href=["']javascript:[^"']*["']/gi, 'href="#"');
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function nonEmpty(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toArray(val: Set<string> | string[] | undefined): string[] {
  if (!val) return [];
  if (val instanceof Set) return Array.from(val);
  return val;
}
