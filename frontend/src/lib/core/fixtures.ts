// Demo-only fixture scaffolding for frontend features that do not have backend support yet.
// Keep this module empty of sample records. Live job data belongs in lib/api.ts and lib/jobs.ts.

export const DEMO_ONLY_FIXTURE_NOTICE =
  "Demo-only frontend fixture. Replace with a backend API before showing as user data.";

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
  kind: "published" | "discovered" | "verified" | "updated" | "rechecked" | "expired";
  at: string;
  note?: string;
}

export interface Company {
  slug: string;
  name: string;
  sector: string;
  sizeBand: string;
  website: string;
  hq: string;
  locations: string[];
  about: string;
  momentum: {
    tone: "positive" | "caution" | "neutral" | "insufficient";
    summary: string;
    coverage: string;
    series: { label: string; openings: number }[];
    signals: {
      at: string;
      kind: "hiring" | "funding" | "office" | "layoff" | "remote-policy" | "expansion" | "visa";
      title: string;
      basis: "evidence" | "inference";
      source: string;
      sourceUrl: string;
    }[];
  };
}

export interface Job {
  slug: string;
  title: string;
  companySlug: string;
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
    responsibilities: string[];
    required: string[];
    preferred: string[];
    benefits: string[];
    workAuthorization: string;
  };
  flags?: ("expired" | "suspicious" | "missing-data")[];
}

export interface NewsItem {
  slug: string;
  headline: string;
  publisher: string;
  publishedAt: string;
  category:
    | "Hiring"
    | "Funding"
    | "Layoffs"
    | "New office"
    | "Remote policy"
    | "Visa & policy"
    | "Graduate programs"
    | "Labor trends";
  summary: string;
  keyFacts: string[];
  companies: string[];
  locations: string[];
  hiringImpact: { label: "Likely more hiring" | "Mixed signal" | "Likely fewer roles" | "Unclear"; rationale: string };
  sourceUrl: string;
  relatedJobs: string[];
  image?: string;
}

export type TrackerStatus = "Saved" | "Applied" | "Interview" | "Offer" | "Rejected" | "Withdrawn";

export interface TrackerItem {
  id: string;
  jobSlug: string;
  status: TrackerStatus;
  updatedAt: string;
  source: string;
  resumeVersion?: string;
  nextAction?: string;
  reminderAt?: string;
  history: { status: TrackerStatus; at: string }[];
  notes?: string;
}

export interface SavedSearch {
  id: string;
  name: string;
  criteria: string[];
  frequency: "Instant" | "Daily" | "Weekly";
  expectedVolume: string;
  lastMatch: string;
  paused?: boolean;
}

export interface Alert {
  id: string;
  name: string;
  chips: string[];
  cadence: "Instant" | "Daily" | "Weekly";
  channels: ("In-app" | "Email")[];
  status: "Active" | "Paused";
  volume: string;
  lastSent?: string;
}

export const companies: Company[] = [];
export const jobs: Job[] = [];
export const news: NewsItem[] = [];
export const trackerItems: TrackerItem[] = [];
export const savedSearches: SavedSearch[] = [];
export const alerts: Alert[] = [];

export function getCompany(slug: string): Company | undefined {
  return companies.find((company) => company.slug === slug);
}

export function getJob(slug: string): Job | undefined {
  return jobs.find((job) => job.slug === slug);
}

export function getNews(slug: string): NewsItem | undefined {
  return news.find((item) => item.slug === slug);
}

export function companyName(slug: string): string {
  return getCompany(slug)?.name ?? slug;
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
];
