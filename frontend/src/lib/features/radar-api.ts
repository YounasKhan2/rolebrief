import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, type ApiJob } from "../core/api";
import { authRequest } from "../auth/auth-api";
import { mapApiJob, type Job } from "../jobs/jobs";
import type { EligibilitySummary } from "../jobs/eligibility";
import type { MatchBriefSummary } from "../jobs/match-briefs";

export interface RadarFeedItem {
  job: ApiJob;
  rank: number;
  reasonCodes: string[];
  matchBrief: MatchBriefSummary | null;
  eligibility: EligibilitySummary | null;
  jobAvailability: {
    status: string;
    canApply: boolean;
    reason: string | null;
  };
  saved: boolean | null;
  tracked: boolean | null;
}

export interface RadarSummary {
  savedJobs: number | null;
  activeApplications: number | null;
  upcomingActions: Array<{
    id: string;
    roleTitle: string;
    companyName: string | null;
    nextAction: string | null;
    nextActionAt: string | null;
    jobSlug: string | null;
  }>;
  newRadarRoles: number;
  employerDeadlines: Array<{
    slug: string;
    rank: number;
    deadlineAt: string;
  }>;
}

export interface RadarFeedResponse {
  data: RadarFeedItem[];
  pageInfo: {
    feedSnapshotId: string;
    nextCursor: string | null;
    hasNextPage: boolean;
    expiresAt: string;
  };
  summary: RadarSummary;
  candidateCounts: {
    sqlCandidates: number;
    enrichmentCandidates: number;
    ranked: number;
  };
}

export interface RadarFeedParams {
  limit?: number;
  cursor?: string | null;
  sort?: "relevance" | "freshest";
  eligibility?: "NO_KNOWN_CONFLICTS" | "INCLUDE_ALL";
  tracked?: "include" | "exclude" | "only";
  alignment?: Array<"STRONG_ALIGNMENT" | "PARTIAL_ALIGNMENT" | "LIMITED_ALIGNMENT" | "NOT_CALCULATED">;
  signal?: AbortSignal;
}

export interface RadarJob extends Job {
  radarRank: number;
  saved: boolean | null;
  tracked: boolean | null;
  jobAvailability: RadarFeedItem["jobAvailability"];
  eligibilitySummary: EligibilitySummary | null;
}

export interface RadarState {
  data: RadarJob[];
  summary: RadarSummary | null;
  loading: boolean;
  loadingMore: boolean;
  error: ApiError | null;
  notice: string | null;
  appendedAnnouncement: string;
  hasNextPage: boolean;
  loadMore: () => void;
  retry: () => void;
}

export function fetchRadarFeed(params: RadarFeedParams = {}) {
  const search = new URLSearchParams();
  if (params.limit != null) search.set("limit", String(params.limit));
  if (params.cursor) search.set("cursor", params.cursor);
  if (params.sort) search.set("sort", params.sort);
  if (params.eligibility) search.set("eligibility", params.eligibility);
  if (params.tracked) search.set("tracked", params.tracked);
  if (params.alignment?.length) search.set("alignment", params.alignment.join(","));
  const qs = search.toString();
  return authRequest<RadarFeedResponse>(`/radar/feed${qs ? `?${qs}` : ""}`, { signal: params.signal });
}

export function useRadarFeed(params: Omit<RadarFeedParams, "cursor" | "signal"> = {}): RadarState {
  const [data, setData] = useState<RadarJob[]>([]);
  const [summary, setSummary] = useState<RadarSummary | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [appendedAnnouncement, setAppendedAnnouncement] = useState("");
  const [version, setVersion] = useState(0);

  const queryKey = useMemo(
    () => radarParamsKey(params),
    [params.limit, params.sort, params.eligibility, params.tracked, params.alignment?.join(",")]
  );
  const activeKeyRef = useRef(queryKey);
  const nextCursorRef = useRef<string | null>(null);
  const hasNextPageRef = useRef(false);
  const inFlightCursors = useRef<Set<string>>(new Set());
  const consumedCursors = useRef<Set<string>>(new Set());
  const loadMoreControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const snapshotNoticeRef = useRef<string | null>(null);

  useEffect(() => {
    activeKeyRef.current = queryKey;
    nextCursorRef.current = null;
    hasNextPageRef.current = false;
    inFlightCursors.current.clear();
    consumedCursors.current.clear();
    loadMoreControllerRef.current?.abort("query_changed");
    loadMoreControllerRef.current = null;
    setData([]);
    setSummary(null);
    setNextCursor(null);
    setHasNextPage(false);
    setLoading(true);
    setError(null);
    setNotice(snapshotNoticeRef.current);
    snapshotNoticeRef.current = null;
    setAppendedAnnouncement("");

    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    fetchRadarFeed({ ...params, cursor: null, signal: controller.signal })
      .then((response) => {
        if (requestId !== requestIdRef.current || activeKeyRef.current !== queryKey) return;
        setData(response.data.map(mapRadarItem));
        setSummary(response.summary);
        setNextCursor(response.pageInfo.nextCursor);
        nextCursorRef.current = response.pageInfo.nextCursor;
        setHasNextPage(response.pageInfo.hasNextPage);
        hasNextPageRef.current = response.pageInfo.hasNextPage;
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof ApiError ? err : new ApiError("Could not load Radar.", "network"));
      })
      .finally(() => {
        if (!controller.signal.aborted && requestId === requestIdRef.current) setLoading(false);
      });

    return () => {
      controller.abort();
      loadMoreControllerRef.current?.abort("query_changed");
      loadMoreControllerRef.current = null;
    };
  }, [queryKey, version]);

  const loadMore = useCallback(() => {
    const cursor = nextCursorRef.current;
    if (
      !cursor ||
      !hasNextPageRef.current ||
      loading ||
      loadingMore ||
      inFlightCursors.current.has(cursor) ||
      consumedCursors.current.has(cursor)
    ) {
      return;
    }
    const controller = new AbortController();
    loadMoreControllerRef.current?.abort("superseded");
    loadMoreControllerRef.current = controller;
    const requestKey = activeKeyRef.current;
    inFlightCursors.current.add(cursor);
    setLoadingMore(true);
    setError(null);
    fetchRadarFeed({ ...params, cursor, signal: controller.signal })
      .then((response) => {
        if (activeKeyRef.current !== requestKey) return;
        consumedCursors.current.add(cursor);
        let appendedCount = 0;
        setData((prev) => {
          const next = appendUniqueRadarJobs(prev, response.data.map(mapRadarItem));
          appendedCount = next.length - prev.length;
          return next;
        });
        setAppendedAnnouncement(appendedCount > 0 ? `${appendedCount} more opportunities loaded.` : "No new opportunities were added.");
        setSummary(response.summary);
        setNextCursor(response.pageInfo.nextCursor);
        nextCursorRef.current = response.pageInfo.nextCursor;
        setHasNextPage(response.pageInfo.hasNextPage);
        hasNextPageRef.current = response.pageInfo.hasNextPage;
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        const apiError = err instanceof ApiError ? err : new ApiError("Could not load more Radar jobs.", "network");
        if (isFeedSnapshotExpired(apiError)) {
          snapshotNoticeRef.current = "Radar refreshed because the previous feed snapshot expired.";
          setVersion((v) => v + 1);
          return;
        }
        if (apiError.status === 429) {
          setNotice(apiError.retryAfterSeconds ? `Radar is rate limited. Try again in ${apiError.retryAfterSeconds} seconds.` : "Radar is rate limited. Please try again shortly.");
        }
        setError(apiError);
      })
      .finally(() => {
        inFlightCursors.current.delete(cursor);
        if (loadMoreControllerRef.current === controller) loadMoreControllerRef.current = null;
        setLoadingMore(false);
      });
  }, [loading, loadingMore, queryKey]);

  return {
    data,
    summary,
    loading,
    loadingMore,
    error,
    notice,
    appendedAnnouncement,
    hasNextPage,
    loadMore,
    retry: () => {
      setError(null);
      setNotice(null);
      setVersion((v) => v + 1);
    }
  };
}

function mapRadarItem(item: RadarFeedItem): RadarJob {
  const mapped = mapApiJob(item.job);
  return {
    ...mapped,
    radarRank: item.rank,
    saved: item.saved,
    tracked: item.tracked,
    jobAvailability: item.jobAvailability,
    eligibilitySummary: item.eligibility,
    eligibility: item.eligibility
      ? {
          state: mapEligibilityState(item.eligibility.overallStatus),
          reasons: [{ label: item.eligibility.headline, kind: mapEligibilityState(item.eligibility.overallStatus) }]
        }
      : mapped.eligibility,
    match: item.matchBrief ? { ...mapped.match, summary: item.matchBrief } : mapped.match,
    reasons: reasonLabels(item)
  };
}

function mapEligibilityState(status: EligibilitySummary["overallStatus"]) {
  if (status === "APPEARS_ELIGIBLE" || status === "LIKELY_ELIGIBLE") return "eligible";
  if (status === "CONFLICT") return "conflict";
  if (status === "CHECK_REQUIRED") return "check";
  return "unknown";
}

function reasonLabels(item: RadarFeedItem) {
  const labels: string[] = [];
  if (item.saved === true) labels.push("Saved");
  if (item.tracked === true) labels.push("Tracked");
  if (item.reasonCodes.includes("JOB_FIRST_SEEN_WITHIN_7_DAYS")) labels.push("New this week");
  if (item.matchBrief) labels.push(item.matchBrief.label);
  if (!item.jobAvailability.canApply) labels.push(item.jobAvailability.reason || "Apply availability unclear");
  return labels.length > 0 ? labels : ["Radar candidate"];
}

export function radarParamsKey(params: Omit<RadarFeedParams, "cursor" | "signal"> = {}) {
  return JSON.stringify({
    limit: params.limit ?? 20,
    sort: params.sort ?? "relevance",
    eligibility: params.eligibility ?? "INCLUDE_ALL",
    tracked: params.tracked ?? "include",
    alignment: params.alignment ?? []
  });
}

export function appendUniqueRadarJobs(existing: RadarJob[], incoming: RadarJob[]): RadarJob[] {
  const known = new Set(existing.map((job) => job.slug));
  const appended: RadarJob[] = [];
  for (const item of incoming) {
    if (known.has(item.slug)) continue;
    known.add(item.slug);
    appended.push(item);
  }
  return [...existing, ...appended];
}

export function isFeedSnapshotExpired(error: ApiError): boolean {
  return error.status === 410 && error.payload?.code === "FEED_SNAPSHOT_EXPIRED";
}
