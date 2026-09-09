export type CanonicalRemoteScope =
  | "WORLDWIDE"
  | "COUNTRY_LIMITED"
  | "TIMEZONE_LIMITED"
  | "COUNTRY_AND_TIMEZONE_LIMITED"
  | "UNKNOWN";

export interface CandidateEligibilityFacts {
  readonly userId: string;
  readonly currentCountry: string | null;
  readonly workAuthorizations: readonly string[];
  readonly requiresVisaSponsorship: boolean | null;
  readonly timezone: string | null;
  readonly revision: number;
}

export interface JobEligibilityFacts {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly companyName: string;
  readonly workMode: string;
  readonly remoteScope: CanonicalRemoteScope;
  readonly remoteCountryCodes: readonly string[];
  readonly remoteRestrictionLabels: readonly string[];
  readonly unresolvedLabels: readonly string[];
  readonly timezoneOffsetMinutes: readonly number[];
  readonly jobStatus: "ACTIVE" | "EXPIRED" | "DELISTED";
  readonly flags?: readonly string[];
  readonly applicationDeadlineAt: Date | null;
  readonly applicationUrl: string | null;
  readonly canonicalFingerprint: string;
}

