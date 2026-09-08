export type ProviderKey = "himalayas.guid" | (string & {});
export type IngestionMode = "smoke" | "backfill" | "incremental";
export type PaginationKind = "cursor" | "page" | "offset";

export interface ProviderCapabilities {
  pagination: PaginationKind;
  maxPageSize: number;
  hasExpiry: boolean;
  hasApplicationDeadline: boolean;
  hasSalary: boolean;
  hasCountryRestrictions: boolean;
  hasTimezoneRestrictions: boolean;
  descriptionFormat: "html" | "plain_text";
  search: "none" | "filter" | "full_text";
  refreshInterval: string;
  attribution: string;
}

export interface ProviderPageRequest {
  cursor: string | null;
  limit: number;
  mode: IngestionMode;
  signal?: AbortSignal;
}

export interface ProviderPage<TRecord> {
  records: TRecord[];
  nextCursor: string | null;
  fetchedAt: Date;
  partialFailures: ProviderFailure[];
  terminal: boolean;
}

export interface ProviderFailure {
  cursor: string | null;
  status?: number;
  message: string;
  retryable: boolean;
}

export interface ValidationResult<TRecord> {
  ok: boolean;
  record?: TRecord;
  error?: string;
}

export interface CanonicalRemoteRestrictions {
  scope: "WORLDWIDE" | "COUNTRY_LIMITED" | "TIMEZONE_LIMITED" | "COUNTRY_AND_TIMEZONE_LIMITED" | "UNKNOWN";
  countries: { alpha2: string | null; name: string; slug: string }[];
  countryCodes: string[];
  labels: string[];
  unresolvedLabels: string[];
  timezones: string[];
  timezoneOffsetMinutes: number[];
  provider?: string;
}

export interface CanonicalJobInput<TRecord = unknown> {
  externalId: string;
  slug: string;
  title: string;
  companySlug: string;
  companyName: string;
  companyLogo: string | null;
  descriptionHtml: string | null;
  descriptionText: string | null;
  employmentType: string | null;
  seniority: string | null;
  workMode: "ONSITE" | "HYBRID" | "REMOTE" | "UNKNOWN";
  remote: CanonicalRemoteRestrictions;
  sourcePublishedAt: Date | null;
  sourceUpdatedAt: Date | null;
  providerExpiresAt: Date | null;
  applicationDeadlineAt: Date | null;
  applicationUrl: string;
  sourceUrl: string;
  contentHash: string;
  canonicalFingerprint: string;
  categories: string[];
  parentCategories: string[];
  salary: { min: number | null; max: number | null; currency: string | null; period: string | null } | null;
  raw: TRecord;
}

export interface JobProviderAdapter<TRecord = unknown> {
  readonly key: ProviderKey;
  readonly capabilities: ProviderCapabilities;
  isEnabled(): boolean;
  pageLimitFor(mode: IngestionMode): number;
  requestDelayMs(): number;
  unchangedStopThreshold(): number;
  fetchPage(request: ProviderPageRequest): Promise<ProviderPage<unknown>>;
  validateRecord(input: unknown): ValidationResult<TRecord>;
  normalize(record: TRecord): CanonicalJobInput<TRecord>;
  getExternalIdentity(record: TRecord): string;
}
