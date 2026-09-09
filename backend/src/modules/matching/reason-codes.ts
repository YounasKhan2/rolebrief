export type MatchDimension = "TITLE" | "SENIORITY" | "EMPLOYMENT_TYPE" | "WORK_MODE" | "COMPENSATION";

export type MatchDimensionState = "MATCH" | "PARTIAL" | "GAP" | "UNKNOWN" | "NOT_APPLICABLE";

export type MatchBriefStatus =
  | "STRONG_ALIGNMENT"
  | "PARTIAL_ALIGNMENT"
  | "LIMITED_ALIGNMENT"
  | "NOT_CALCULATED";

export type MatchFactProvenance = "USER_DECLARED" | "PROVIDER_STRUCTURED" | "NORMALIZED_PROVIDER" | "UNAVAILABLE";

export interface MatchFact {
  label: string;
  value: string;
  provenance: MatchFactProvenance;
}

export interface MatchDimensionResult {
  dimension: MatchDimension;
  status: MatchDimensionState;
  reasonCode: string;
  candidateFact: MatchFact;
  jobFact: MatchFact;
  explanation: string;
}

export interface MatchEvidenceSummary {
  dimension: MatchDimension;
  reasonCode: string;
  label: string;
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

