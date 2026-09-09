import { Injectable } from "@nestjs/common";
import type { EligibilitySummary } from "../eligibility/reason-codes";
import type { MatchBriefSummary } from "../matching/reason-codes";
import { RadarCandidate, RadarSnapshotItem } from "./radar.types";

@Injectable()
export class RadarRankingService {
  preOrder(candidates: RadarCandidate[], max: number): RadarCandidate[] {
    return [...candidates]
      .sort((a, b) => a.cheapRank - b.cheapRank || freshnessMs(b) - freshnessMs(a) || b.id.localeCompare(a.id))
      .slice(0, max);
  }

  rank(params: {
    candidates: RadarCandidate[];
    matchBriefs: Map<string, MatchBriefSummary>;
    eligibility: Map<string, EligibilitySummary>;
    trackedAtSnapshot: Set<string>;
    preference: {
      workMode: string | null;
      employmentTypes: string[];
    };
    sort: "relevance" | "freshest";
  }): RadarSnapshotItem[] {
    return params.candidates
      .map((candidate) => {
        const match = params.matchBriefs.get(candidate.slug) ?? null;
        const eligibility = params.eligibility.get(candidate.slug) ?? null;
        const futureDeadline =
          candidate.applicationDeadlineAt && candidate.applicationDeadlineAt.getTime() > Date.now()
            ? candidate.applicationDeadlineAt.toISOString()
            : null;
        const canApply =
          candidate.status === "ACTIVE" &&
          Boolean(candidate.applicationUrl) &&
          (!candidate.applicationDeadlineAt || candidate.applicationDeadlineAt.getTime() > Date.now());
        const item: RadarSnapshotItem = {
          id: candidate.id,
          slug: candidate.slug,
          rank: 0,
          reasonCodes: [
            ...candidate.laneReasons,
            match ? `MATCH_${match.status}` : "MATCH_NOT_CALCULATED",
            eligibility ? `ELIGIBILITY_${eligibility.overallStatus}` : "ELIGIBILITY_NOT_CALCULATED"
          ],
          jobAvailability: eligibility?.jobAvailability ?? {
            status: candidate.status,
            canApply,
            reason: canApply ? null : "Application destination is unavailable or the listing is no longer active."
          },
          matchBrief: match,
          eligibility,
          ranking: {
            activeApplyTier: canApply ? 0 : 1,
            matchTier: matchTier(match),
            comparableEvidence: match?.comparableDimensionCount ?? 0,
            eligibilityTier: eligibilityTier(eligibility),
            preferenceTier: preferenceTier(candidate, params.preference),
            trackedTier: params.trackedAtSnapshot.has(candidate.slug) ? 1 : 0,
            firstSeenAt: candidate.firstSeenAt.toISOString(),
            freshnessAt: new Date(candidate.publishedAt ?? candidate.firstSeenAt).toISOString(),
            deadlineAt: futureDeadline,
            stableJobId: candidate.id
          }
        };
        return item;
      })
      .sort((a, b) => compareRank(a, b, params.sort))
      .map((item, index) => ({ ...item, rank: index + 1 }));
  }
}

function compareRank(a: RadarSnapshotItem, b: RadarSnapshotItem, sort: "relevance" | "freshest") {
  if (sort === "freshest") {
    return Date.parse(b.ranking.freshnessAt) - Date.parse(a.ranking.freshnessAt) || a.id.localeCompare(b.id);
  }
  return (
    a.ranking.activeApplyTier - b.ranking.activeApplyTier ||
    a.ranking.matchTier - b.ranking.matchTier ||
    b.ranking.comparableEvidence - a.ranking.comparableEvidence ||
    a.ranking.eligibilityTier - b.ranking.eligibilityTier ||
    a.ranking.preferenceTier - b.ranking.preferenceTier ||
    a.ranking.trackedTier - b.ranking.trackedTier ||
    Date.parse(b.ranking.freshnessAt) - Date.parse(a.ranking.freshnessAt) ||
    compareDeadline(a.ranking.deadlineAt, b.ranking.deadlineAt) ||
    a.id.localeCompare(b.id)
  );
}

function compareDeadline(a: string | null, b: string | null) {
  if (a && b) return Date.parse(a) - Date.parse(b);
  if (a) return -1;
  if (b) return 1;
  return 0;
}

function freshnessMs(candidate: RadarCandidate) {
  return new Date(candidate.publishedAt ?? candidate.firstSeenAt).getTime();
}

function matchTier(match: MatchBriefSummary | null) {
  if (!match) return 3;
  switch (match.status) {
    case "STRONG_ALIGNMENT":
      return 0;
    case "PARTIAL_ALIGNMENT":
      return 1;
    case "LIMITED_ALIGNMENT":
      return 2;
    default:
      return 3;
  }
}

function eligibilityTier(summary: EligibilitySummary | null) {
  if (!summary) return 3;
  switch (summary.overallStatus) {
    case "APPEARS_ELIGIBLE":
    case "LIKELY_ELIGIBLE":
      return 0;
    case "CHECK_REQUIRED":
      return 1;
    case "CONFLICT":
      return 2;
    default:
      return 3;
  }
}

function preferenceTier(candidate: RadarCandidate, preference: { workMode: string | null; employmentTypes: string[] }) {
  let misses = 0;
  const preferredWorkMode = preferredJobWorkMode(preference.workMode);
  if (preferredWorkMode && candidate.workMode && preferredWorkMode !== candidate.workMode) misses += 1;
  if (preference.employmentTypes.length > 0 && candidate.employmentType) {
    const normalized = candidate.employmentType.toUpperCase().replace(/[\s-]+/g, "_");
    if (!preference.employmentTypes.includes(normalized)) misses += 1;
  }
  return misses;
}

function preferredJobWorkMode(remotePreference: string | null) {
  switch (remotePreference) {
    case "REMOTE_ONLY":
      return "REMOTE";
    case "HYBRID":
      return "HYBRID";
    case "ONSITE":
      return "ONSITE";
    default:
      return null;
  }
}
