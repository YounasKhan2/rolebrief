import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../core/api";
import { authRequest, type AuthUser } from "../auth/auth-api";

export type MatchBriefStatus = "STRONG_ALIGNMENT" | "PARTIAL_ALIGNMENT" | "LIMITED_ALIGNMENT" | "NOT_CALCULATED";
export type MatchDimensionState = "MATCH" | "PARTIAL" | "GAP" | "UNKNOWN" | "NOT_APPLICABLE";
export type MatchDimensionName = "TITLE" | "SENIORITY" | "EMPLOYMENT_TYPE" | "WORK_MODE" | "COMPENSATION";

export interface MatchEvidenceSummary {
  dimension: MatchDimensionName;
  reasonCode: string;
  label: string;
}

export interface MatchFact {
  label: string;
  value: string;
  provenance: "USER_DECLARED" | "PROVIDER_STRUCTURED" | "NORMALIZED_PROVIDER" | "UNAVAILABLE";
}

export interface MatchDimensionResult {
  dimension: MatchDimensionName;
  status: MatchDimensionState;
  reasonCode: string;
  candidateFact: MatchFact;
  jobFact: MatchFact;
  explanation: string;
}

export interface MatchBriefSummary {
  engineVersion: string;
  taxonomyVersion: string;
  jobSlug: string;
  status: MatchBriefStatus;
  label: string;
  scorePercent: null;
  coveragePercent: number;
  comparableDimensionCount: number;
  primaryReasonCode: string;
  strengths: MatchEvidenceSummary[];
  gaps: MatchEvidenceSummary[];
  unknowns: MatchEvidenceSummary[];
  profileRevision: number;
  jobMatchVersion: string;
  calculatedAt: string;
}

export interface MatchBriefDetail extends MatchBriefSummary {
  dimensions: MatchDimensionResult[];
}

const summaryCache = new Map<string, MatchBriefSummary>();
const inFlightBatches = new Map<string, Promise<MatchBriefSummary[]>>();

export function clearMatchBriefCache(): void {
  summaryCache.clear();
  inFlightBatches.clear();
}

export async function fetchMatchBriefBatch(slugs: string[], signal?: AbortSignal): Promise<MatchBriefSummary[]> {
  const unique = Array.from(new Set(slugs.filter(Boolean)));
  if (unique.length === 0) return [];
  const chunks: string[][] = [];
  for (let index = 0; index < unique.length; index += 50) chunks.push(unique.slice(index, index + 50));
  const results: MatchBriefSummary[] = [];
  for (const chunk of chunks) {
    const key = chunk.join("|");
    const request = inFlightBatches.get(key) ?? authRequest<MatchBriefSummary[]>(
      "/match-briefs/batch",
      { method: "POST", body: { slugs: chunk }, csrf: true, signal }
    ).finally(() => inFlightBatches.delete(key));
    inFlightBatches.set(key, request);
    const batch = await request;
    for (const summary of batch) {
      summaryCache.set(summary.jobSlug, summary);
      results.push(summary);
    }
  }
  return results;
}

export async function fetchMatchBriefDetail(slug: string, signal?: AbortSignal): Promise<MatchBriefDetail> {
  return authRequest<MatchBriefDetail>(`/match-briefs/jobs/${encodeURIComponent(slug)}`, { signal });
}

export function useBatchMatchBriefs(slugs: string[], user: AuthUser | null, enabled: boolean): {
  summaries: Map<string, MatchBriefSummary>;
  loading: boolean;
  error: ApiError | null;
  retry: () => void;
} {
  const [summaries, setSummaries] = useState<Map<string, MatchBriefSummary>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [version, setVersion] = useState(0);
  const previousUser = useRef<string | null>(null);
  const key = useMemo(() => Array.from(new Set(slugs)).sort().join("|"), [slugs]);

  useEffect(() => {
    if (previousUser.current && previousUser.current !== user?.id) clearMatchBriefCache();
    previousUser.current = user?.id ?? null;
  }, [user?.id]);

  useEffect(() => {
    if (!enabled || !user || user.role !== "USER" || key.length === 0) {
      setSummaries(new Map());
      setLoading(false);
      setError(null);
      return;
    }

    const orderedSlugs = Array.from(new Set(slugs));
    const cached = new Map<string, MatchBriefSummary>();
    const missing: string[] = [];
    for (const slug of orderedSlugs) {
      const found = summaryCache.get(slug);
      if (found) cached.set(slug, found);
      else missing.push(slug);
    }
    setSummaries(cached);
    if (missing.length === 0) {
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchMatchBriefBatch(missing, controller.signal)
      .then((items) => {
        setSummaries((prev) => {
          const next = new Map(prev);
          for (const item of items) next.set(item.jobSlug, item);
          return next;
        });
      })
      .catch((err) => {
        if (err instanceof ApiError && err.code === "aborted") return;
        if (controller.signal.aborted) return;
        setError(err instanceof ApiError ? err : new ApiError("Could not load Match Briefs.", "network"));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [enabled, user?.id, user?.role, key, version]);

  return { summaries, loading, error, retry: () => setVersion((v) => v + 1) };
}
