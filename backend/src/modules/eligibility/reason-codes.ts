import type { CanonicalRemoteScope } from "./factual-facts.interface";

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

export enum ReasonCode {
  // Location
  LOC_WORLDWIDE_NO_RESTRICTIONS = "LOC_WORLDWIDE_NO_RESTRICTIONS",
  LOC_COUNTRY_AUTHORIZED = "LOC_COUNTRY_AUTHORIZED",
  LOC_COUNTRY_CITIZEN_RESIDENT = "LOC_COUNTRY_CITIZEN_RESIDENT",
  LOC_COUNTRY_NOT_AUTHORIZED = "LOC_COUNTRY_NOT_AUTHORIZED",
  LOC_COUNTRY_UNRESOLVED_INSPECTION = "LOC_COUNTRY_UNRESOLVED_INSPECTION",
  LOC_SCOPE_UNKNOWN_CHECK_REQUIRED = "LOC_SCOPE_UNKNOWN_CHECK_REQUIRED",
  LOC_CANDIDATE_COUNTRY_UNSPECIFIED = "LOC_CANDIDATE_COUNTRY_UNSPECIFIED",

  // Timezone
  TZ_NO_DECLARED_RESTRICTION = "TZ_NO_DECLARED_RESTRICTION",
  TZ_WITHIN_DECLARED_OFFSET = "TZ_WITHIN_DECLARED_OFFSET",
  TZ_OUTSIDE_DECLARED_OFFSET = "TZ_OUTSIDE_DECLARED_OFFSET",
  TZ_CANDIDATE_UNSPECIFIED = "TZ_CANDIDATE_UNSPECIFIED",

  // Sponsorship
  SPON_SELF_AUTHORIZED_IN_TARGET = "SPON_SELF_AUTHORIZED_IN_TARGET",
  SPON_NOT_REQUIRED_BY_CANDIDATE = "SPON_NOT_REQUIRED_BY_CANDIDATE",
  SPON_NEEDED_EMPLOYER_UNSTATED = "SPON_NEEDED_EMPLOYER_UNSTATED",
  SPON_EXPLICIT_NO_SPONSORSHIP_CONFLICT = "SPON_EXPLICIT_NO_SPONSORSHIP_CONFLICT",

  // General Profile
  PROFILE_INCOMPLETE = "PROFILE_INCOMPLETE"
}

export interface DimensionResult {
  readonly dimension: DimensionType;
  readonly status: DimensionEvaluationStatus;
  readonly reasonCode: ReasonCode;
  readonly headline: string;
  readonly details: string;
  readonly evidence?: Record<string, any>;
}

export interface EligibilitySummary {
  readonly slug: string;
  readonly overallStatus: OverallEligibilityStatus;
  readonly primaryReasonCode: ReasonCode;
  readonly badgeText: string;
  readonly headline: string;
  readonly jobAvailability: JobAvailability;
  readonly isJobExpired: boolean;
}

export interface DetailedEligibilityResult extends EligibilitySummary {
  readonly dimensions: DimensionResult[];
  readonly knownFacts: {
    readonly candidateResidenceCountry: string | null;
    readonly candidateWorkAuthorizations: readonly string[];
    readonly candidateRequiresSponsorship: boolean | null;
    readonly candidateTimezone: string | null;
    readonly jobWorkMode: string;
    readonly jobRemoteScope: CanonicalRemoteScope;
    readonly jobAllowedCountries: readonly string[];
    readonly jobTimezoneOffsets: readonly number[];
  };
  readonly unstatedFacts: readonly string[];
  readonly evaluatedAt: string;
  readonly disclaimer: string;
}

export const ELIGIBILITY_DISCLAIMER =
  "Eligibility Shield evaluations are deterministic estimates based on candidate self-reported facts and employer-stated requirements. They do not constitute legal advice or guarantee employment eligibility.";

