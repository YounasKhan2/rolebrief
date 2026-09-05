import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, getJob as getApiJob, listJobs, type ApiJob } from "./api";
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
  seniority: string;
  employmentType: string;
  discipline: string;
  skills: string[];
  salary: { text: string; provided: boolean } | null;
  source: string;
  sourceUrl: string;
  applyUrl: string;
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

export interface JobsState {
  data: Job[];
  loading: boolean;
  error: ApiError | null;
  nextCursor: string | null;
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

export function useJobs(params: { cursor?: string | null; limit?: number } = {}): JobsState {
  const [data, setData] = useState<Job[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    listJobs({ cursor: params.cursor, limit: params.limit, signal: controller.signal })
      .then((response) => {
        setData(response.data.map(mapApiJob));
        setNextCursor(response.pageInfo.nextCursor);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.code === "aborted") return;
        setError(err instanceof ApiError ? err : new ApiError("Could not load jobs.", "network"));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [params.cursor, params.limit, version]);

  const retry = useCallback(() => setVersion((v) => v + 1), []);
  return { data, loading, error, nextCursor, retry };
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

export function useSimilarJobs(job: Job | null, limit = 2) {
  const { data, loading, error, retry } = useJobs({ limit: 50 });
  const similar = useMemo(() => {
    if (!job) return [];
    return data
      .filter((candidate) => candidate.slug !== job.slug)
      .filter((candidate) => candidate.discipline === job.discipline || candidate.companySlug === job.companySlug)
      .slice(0, limit);
  }, [data, job, limit]);
  return { data: similar, loading, error, retry };
}

export function companyName(jobOrSlug: Job | string): string {
  return typeof jobOrSlug === "string" ? jobOrSlug : jobOrSlug.companyName;
}

function mapApiJob(job: ApiJob): Job {
  const sourceUrl = job.source?.url || "";
  const applicationUrl = job.applicationUrl || sourceUrl;
  const companyName = nonEmpty(job.company?.name) ?? "Unknown company";
  const publishedAt = job.publishedAt ?? new Date().toISOString();
  const providerExpired = job.providerExpiresAt ? new Date(job.providerExpiresAt).getTime() < Date.now() : false;
  const applicationDeadlinePassed = job.applicationDeadlineAt ? new Date(job.applicationDeadlineAt).getTime() < Date.now() : false;
  const expired = providerExpired || applicationDeadlinePassed;
  const sourceDomain = sourceUrl ? domainFromUrl(sourceUrl) : "source unavailable";
  const workModel = mapWorkMode(job.workMode);
  const remoteEligibility = mapRemoteEligibility(job.workMode, job.remoteScope);
  const descriptionHtml = sanitizeHtml(job.descriptionHtml);
  const overview = nonEmpty(stripHtml(job.excerpt ?? descriptionHtml ?? "")) ?? "No description summary is available yet.";

  return {
    slug: job.slug,
    title: nonEmpty(job.title) ?? "Untitled role",
    companySlug: job.company?.slug ?? "unknown-company",
    companyName,
    companyLogoUrl: job.company?.logoUrl ?? null,
    locations: job.locations.map((location) => location.name).filter(Boolean),
    workModel,
    remoteEligibility,
    seniority: nonEmpty(job.seniority) ?? "Unknown",
    employmentType: nonEmpty(job.employmentType) ?? "Unknown",
    discipline: inferDiscipline(job.title, job.excerpt),
    skills: [],
    salary: mapSalary(job.salary),
    source: job.source?.name ?? "Himalayas",
    sourceUrl: sourceUrl || "https://himalayas.app/jobs",
    applyUrl: applicationUrl || "https://himalayas.app/jobs",
    freshness: [
      { kind: "published", at: publishedAt, note: "Provider timestamp" },
      { kind: "discovered", at: publishedAt, note: "Stored from the Himalayas provider" },
      ...(job.applicationDeadlineAt ? [{ kind: "deadline" as const, at: job.applicationDeadlineAt, note: "Apply by" }] : []),
      ...(job.providerExpiresAt
        ? [{
            kind: providerExpired ? "expired" as const : "provider-expiry" as const,
            at: job.providerExpiresAt,
            note: "Provider expiry - listing may be removed from provider",
          }]
        : []),
    ],
    eligibility: {
      state: "check",
      reasons: [
        { label: "Check required. Eligibility rules are not calculated for stored provider jobs yet.", kind: "check" },
        { label: job.remoteRestrictionsText ?? "Work authorization requirement is unavailable.", kind: "unknown" },
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
      workAuthorization: "Unavailable from provider. Confirm with the employer before applying.",
    },
    flags: [
      ...(expired ? ["expired" as const] : []),
      ...(!job.descriptionHtml && !job.excerpt ? ["missing-data" as const] : []),
    ],
  };
}

function mapWorkMode(value: string | null): WorkModel {
  const normalized = value?.toLowerCase() ?? "";
  if (normalized.includes("hybrid")) return "Hybrid";
  if (normalized.includes("on") || normalized.includes("office")) return "On-site";
  return "Remote";
}

function mapRemoteEligibility(workMode: string | null, remoteScope: string | null): RemoteEligibility {
  const combined = `${workMode ?? ""} ${remoteScope ?? ""}`.toLowerCase();
  if (combined.includes("hybrid")) return "hybrid";
  if (combined.includes("on") || combined.includes("office")) return "on-site";
  if (combined.includes("worldwide") || combined.includes("global")) return "worldwide";
  if (combined.includes("country")) return "country-eligible";
  if (combined.includes("timezone")) return "country-eligible";
  if (combined.includes("remote")) return "unknown";
  return "unknown";
}

function mapSalary(salary: ApiJob["salary"]): Job["salary"] {
  if (!salary) return null;
  const min = salary.min == null ? "" : Number(salary.min).toLocaleString();
  const max = salary.max == null ? "" : Number(salary.max).toLocaleString();
  const range = [min, max].filter(Boolean).join("-");
  if (!range || !salary.currency) return null;
  const period = salary.period ? ` / ${salary.period.toLowerCase()}` : "";
  return { text: `${salary.currency} ${range}${period}`, provided: true };
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
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function nonEmpty(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
