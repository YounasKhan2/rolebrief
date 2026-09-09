import type { EligibilitySummary } from "../eligibility/reason-codes";
import type { MatchBriefSummary } from "../matching/reason-codes";

export const RADAR_ENGINE_VERSION = "radar-v1";
export const RADAR_SNAPSHOT_TTL_SECONDS = 30 * 60;
export const RADAR_SQL_CANDIDATE_LIMIT = 400;
export const RADAR_ENRICHMENT_LIMIT = 120;
export const RADAR_DEFAULT_PAGE_SIZE = 20;
export const RADAR_MAX_PAGE_SIZE = 30;
export const RADAR_EVALUATION_CHUNK_SIZE = 50;

export type RadarSort = "relevance" | "freshest";
export type RadarEligibilityFilter = "NO_KNOWN_CONFLICTS" | "INCLUDE_ALL";
export type RadarTrackedFilter = "include" | "exclude" | "only";

export interface RadarCandidate {
  id: string;
  slug: string;
  title: string;
  status: string;
  workMode: string | null;
  employmentType: string | null;
  seniority: string | null;
  firstSeenAt: Date;
  publishedAt: Date | null;
  applicationDeadlineAt: Date | null;
  applicationUrl: string | null;
  companyName: string | null;
  laneReasons: string[];
  cheapRank: number;
}

export interface RadarRankMetadata {
  rank: number;
  reasonCodes: string[];
  jobAvailability: {
    status: string;
    canApply: boolean;
    reason: string | null;
  };
  matchBrief: MatchBriefSummary | null;
  eligibility: EligibilitySummary | null;
  ranking: {
    activeApplyTier: number;
    matchTier: number;
    comparableEvidence: number;
    eligibilityTier: number;
    preferenceTier: number;
    trackedTier: number;
    firstSeenAt: string;
    freshnessAt: string;
    deadlineAt: string | null;
    stableJobId: string;
  };
}

export interface RadarSnapshotItem extends RadarRankMetadata {
  id: string;
  slug: string;
}

export interface RadarSnapshot {
  v: 1;
  engineVersion: string;
  feedSnapshotId: string;
  userId: string;
  profileRevision: number;
  createdAt: string;
  expiresAt: string;
  queryKey: string;
  items: RadarSnapshotItem[];
  candidateCounts: {
    sqlCandidates: number;
    enrichmentCandidates: number;
    ranked: number;
  };
  warnings?: string[];
  filters: Record<string, unknown>;
  cacheStored?: boolean;
}

export interface RadarCursorPayload {
  v: 1;
  engineVersion: string;
  userId: string;
  profileRevision: number;
  feedSnapshotId: string;
  queryKey: string;
  expiresAt: string;
  last: {
    jobId: string;
    rank: number;
  };
}
