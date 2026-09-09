import { useEffect, useRef, useState } from "react";
import { authRequest } from "./auth-api";

export type OverallEligibilityStatus =
  | "APPEARS_ELIGIBLE"
  | "LIKELY_ELIGIBLE"
  | "CHECK_REQUIRED"
  | "CONFLICT"
  | "NOT_CALCULATED";

export type DimensionEvaluationStatus =
  | "SATISFIED"
  | "LIKELY_SATISFIED"
  | "INSUFFICIENT_DATA"
  | "CONFLICT"
  | "NOT_APPLICABLE";

export type DimensionType = "LOCATION" | "TIMEZONE" | "SPONSORSHIP";

export interface JobAvailability {
  readonly status: "ACTIVE" | "EXPIRED" | "DELISTED" | "SUSPICIOUS";
  readonly canApply: boolean;
  readonly reason: string | null;
}

export interface DimensionResult {
  readonly dimension: DimensionType;
  readonly status: DimensionEvaluationStatus;
  readonly reasonCode: string;
  readonly headline: string;
  readonly details: string;
  readonly evidence?: Record<string, any>;
}

export interface EligibilitySummary {
  readonly slug: string;
  readonly overallStatus: OverallEligibilityStatus;
  readonly primaryReasonCode: string;
  readonly badgeText: string;
  readonly headline: string;
  readonly jobAvailability: JobAvailability;
  readonly isJobExpired?: boolean;
}

export interface DetailedEligibilityResult extends EligibilitySummary {
  readonly dimensions: DimensionResult[];
  readonly knownFacts: {
    readonly candidateResidenceCountry: string | null;
    readonly candidateWorkAuthorizations: readonly string[];
    readonly candidateRequiresSponsorship: boolean | null;
    readonly candidateTimezone: string | null;
    readonly jobWorkMode: string;
    readonly jobRemoteScope: string;
    readonly jobAllowedCountries: readonly string[];
    readonly jobTimezoneOffsets: readonly number[];
  };
  readonly unstatedFacts: readonly string[];
  readonly evaluatedAt: string;
  readonly disclaimer: string;
}

// Module-level in-memory cache to prevent redundant fetches across navigation and re-renders
const summaryCache = new Map<string, EligibilitySummary>();
const inFlightBatchRequests = new Set<string>();

/**
 * Resets the in-memory eligibility caches upon user switch or logout.
 */
export function clearEligibilityCache(): void {
  summaryCache.clear();
  inFlightBatchRequests.clear();
}


/**
 * Fetch batch eligibility summaries for up to 50 jobs per chunk.
 */
export async function fetchEligibilityBatch(
  slugs: string[],
  signal?: AbortSignal
): Promise<EligibilitySummary[]> {
  if (slugs.length === 0) return [];

  // Chunk into 50-item batches
  const uniqueSlugs = Array.from(new Set(slugs));
  const chunks: string[][] = [];
  for (let i = 0; i < uniqueSlugs.length; i += 50) {
    chunks.push(uniqueSlugs.slice(i, i + 50));
  }

  const chunkPromises = chunks.map(async (chunk) => {
    try {
      const summaries = await authRequest<EligibilitySummary[]>("/eligibility/batch", {
        method: "POST",
        body: { slugs: chunk },
        signal
      });
      for (const item of summaries) {
        summaryCache.set(item.slug, item);
      }
      return summaries;
    } catch (err) {
      // If unauthorized or forbidden, return empty rather than throwing
      return [];
    }
  });

  const results = await Promise.all(chunkPromises);
  return results.flat();
}

/**
 * Fetch detailed explainable eligibility evaluation for a specific job.
 */
export async function fetchEligibilityJob(
  slug: string,
  signal?: AbortSignal
): Promise<DetailedEligibilityResult | null> {
  try {
    return await authRequest<DetailedEligibilityResult>(`/eligibility/jobs/${encodeURIComponent(slug)}`, {
      method: "GET",
      signal
    });
  } catch {
    return null;
  }
}

/**
 * React hook for differential batching of visible job slugs.
 * Only requests slugs not yet in the module cache, preventing network loops.
 */
export function useBatchEligibility(
  slugs: string[],
  enabled = true
): {
  summaries: Map<string, EligibilitySummary>;
  loading: boolean;
} {
  const [, setVersion] = useState(0);
  const [loading, setLoading] = useState(false);
  const activeControllerRef = useRef<AbortController | null>(null);

  // Derive stable set of slugs to query
  const rawSlugs = slugs.filter(Boolean);
  const stableKey = Array.from(new Set(rawSlugs)).sort().join(",");

  useEffect(() => {
    if (!enabled || rawSlugs.length === 0) {
      return;
    }

    // Determine missing slugs
    const missingSlugs = rawSlugs.filter(
      (slug) => !summaryCache.has(slug) && !inFlightBatchRequests.has(slug)
    );

    if (missingSlugs.length === 0) {
      return;
    }

    // Abort previous in-flight request if new cards arrived
    if (activeControllerRef.current) {
      activeControllerRef.current.abort();
    }
    const controller = new AbortController();
    activeControllerRef.current = controller;

    for (const slug of missingSlugs) {
      inFlightBatchRequests.add(slug);
    }

    setLoading(true);

    fetchEligibilityBatch(missingSlugs, controller.signal)
      .then(() => {
        setVersion((v) => v + 1);
      })
      .finally(() => {
        for (const slug of missingSlugs) {
          inFlightBatchRequests.delete(slug);
        }
        setLoading(false);
      });

    return () => {
      controller.abort();
      for (const slug of missingSlugs) {
        inFlightBatchRequests.delete(slug);
      }
    };
  }, [stableKey, enabled]);

  return {
    summaries: summaryCache,
    loading
  };
}

/**
 * React hook for fetching single job detailed eligibility evaluation.
 */
export function useJobEligibility(
  slug: string | undefined,
  enabled = true
): {
  result: DetailedEligibilityResult | null;
  loading: boolean;
} {
  const [result, setResult] = useState<DetailedEligibilityResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !slug) {
      setResult(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    fetchEligibilityJob(slug, controller.signal)
      .then((data) => {
        setResult(data);
      })
      .finally(() => {
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [slug, enabled]);

  return { result, loading };
}
