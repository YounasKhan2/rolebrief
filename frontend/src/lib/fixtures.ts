// Fixture-driven data for the RoleBrief prototype. No backend — every screen reads
// from here. Content follows the brand voice: information-led, uncertainty stated plainly,
// generated/inferred/unknown data labelled. Timestamps are relative to 2 Sep 2026.

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
  score: number; // 0-100
  note: string;
}

export interface MatchBriefData {
  score: number; // 0-100 overall, always explained
  dimensions: MatchDimension[];
  evidence: string[];
  missing: string[];
  ambiguous: string[];
  suggestions: string[];
}

export interface FreshnessEvent {
  kind: "published" | "discovered" | "verified" | "updated" | "rechecked" | "expired";
  at: string; // ISO
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
    coverage: string; // e.g. "12 signals · last 90 days · partial coverage"
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
  reasons: string[]; // "Why this?" chips
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
  summary: string; // AI-generated, labelled in UI
  keyFacts: string[];
  companies: string[]; // company slugs
  locations: string[];
  hiringImpact: { label: "Likely more hiring" | "Mixed signal" | "Likely fewer roles" | "Unclear"; rationale: string };
  sourceUrl: string;
  relatedJobs: string[]; // job slugs
  image?: string;
}

export const companies: Company[] = [
  {
    slug: "meridian-labs",
    name: "Meridian Labs",
    sector: "Developer tools",
    sizeBand: "201–500",
    website: "https://meridianlabs.dev",
    hq: "Dubai, UAE",
    locations: ["Dubai, UAE", "Karachi, Pakistan", "Remote — worldwide"],
    about:
      "Meridian Labs builds observability and CI tooling for engineering teams across the Gulf and South Asia. The company runs a distributed engineering org with hubs in Dubai and Karachi.",
    momentum: {
      tone: "positive",
      summary:
        "Openings rose after a Series B round. Growth is concentrated in backend and platform roles; treat future hiring as inference, not a guarantee.",
      coverage: "9 signals · last 90 days · partial coverage",
      series: [
        { label: "Jun", openings: 4 },
        { label: "Jul", openings: 6 },
        { label: "Aug", openings: 11 },
        { label: "Sep", openings: 14 },
      ],
      signals: [
        { at: "2026-08-28T09:00:00Z", kind: "funding", title: "Raised $40M Series B led by Gulf Capital", basis: "evidence", source: "MENAbytes", sourceUrl: "https://menabytes.com/meridian-series-b" },
        { at: "2026-08-19T09:00:00Z", kind: "hiring", title: "14 active engineering openings across Dubai and remote", basis: "evidence", source: "RoleBrief index", sourceUrl: "https://meridianlabs.dev/careers" },
        { at: "2026-07-30T09:00:00Z", kind: "office", title: "Opened a Karachi engineering hub", basis: "evidence", source: "TechInAsia", sourceUrl: "https://techinasia.com/meridian-karachi" },
        { at: "2026-07-11T09:00:00Z", kind: "expansion", title: "Platform team expected to double (inferred from role count)", basis: "inference", source: "RoleBrief analysis", sourceUrl: "https://meridianlabs.dev/careers" },
      ],
    },
  },
  {
    slug: "qamar-fintech",
    name: "Qamar Fintech",
    sector: "Financial services",
    sizeBand: "501–1,000",
    website: "https://qamar.finance",
    hq: "Karachi, Pakistan",
    locations: ["Karachi, Pakistan", "Lahore, Pakistan", "Dubai, UAE"],
    about:
      "Qamar Fintech operates digital payments and lending products for the Pakistani market, with a growing UAE remittance corridor.",
    momentum: {
      tone: "caution",
      summary:
        "Hiring continues in compliance and mobile, but a recent restructuring reduced some roles. Signals are mixed; read the timeline before assuming direction.",
      coverage: "7 signals · last 90 days · partial coverage",
      series: [
        { label: "Jun", openings: 9 },
        { label: "Jul", openings: 7 },
        { label: "Aug", openings: 5 },
        { label: "Sep", openings: 6 },
      ],
      signals: [
        { at: "2026-08-22T09:00:00Z", kind: "layoff", title: "Cut ~6% of roles in a support reorganisation", basis: "evidence", source: "Profit by Pakistan Today", sourceUrl: "https://profit.pakistantoday.com.pk/qamar-reorg" },
        { at: "2026-08-05T09:00:00Z", kind: "hiring", title: "Opened 4 mobile engineering roles", basis: "evidence", source: "RoleBrief index", sourceUrl: "https://qamar.finance/careers" },
        { at: "2026-07-18T09:00:00Z", kind: "remote-policy", title: "Moved to hybrid — 3 days in office for Karachi staff", basis: "evidence", source: "Company blog", sourceUrl: "https://qamar.finance/blog/hybrid" },
      ],
    },
  },
  {
    slug: "atlas-health",
    name: "Atlas Health",
    sector: "Health tech",
    sizeBand: "51–200",
    website: "https://atlashealth.io",
    hq: "Remote — worldwide",
    locations: ["Remote — worldwide"],
    about:
      "Atlas Health is a fully-remote company building clinical workflow software. Teams span 14 time zones with async-first practices.",
    momentum: {
      tone: "neutral",
      summary: "Steady, small-batch hiring. No material funding or restructuring signals in the covered window.",
      coverage: "4 signals · last 90 days · limited coverage",
      series: [
        { label: "Jun", openings: 3 },
        { label: "Jul", openings: 3 },
        { label: "Aug", openings: 4 },
        { label: "Sep", openings: 3 },
      ],
      signals: [
        { at: "2026-08-12T09:00:00Z", kind: "remote-policy", title: "Reaffirmed worldwide-remote hiring policy", basis: "evidence", source: "Company handbook", sourceUrl: "https://atlashealth.io/handbook" },
        { at: "2026-07-25T09:00:00Z", kind: "hiring", title: "3 open roles across frontend and data", basis: "evidence", source: "RoleBrief index", sourceUrl: "https://atlashealth.io/jobs" },
      ],
    },
  },
  {
    slug: "northwind-cloud",
    name: "Northwind Cloud",
    sector: "Cloud infrastructure",
    sizeBand: "1,001–5,000",
    website: "https://northwind.cloud",
    hq: "Abu Dhabi, UAE",
    locations: ["Abu Dhabi, UAE", "Dubai, UAE"],
    about:
      "Northwind Cloud provides regional cloud and data-residency services for government and enterprise customers in the UAE.",
    momentum: {
      tone: "insufficient",
      summary: "Not enough recent, verifiable signals to describe a trend. We show what we have and mark the gap.",
      coverage: "2 signals · last 90 days · insufficient coverage",
      series: [
        { label: "Jul", openings: 5 },
        { label: "Sep", openings: 5 },
      ],
      signals: [
        { at: "2026-08-02T09:00:00Z", kind: "office", title: "New Abu Dhabi data centre announced", basis: "evidence", source: "Gulf News", sourceUrl: "https://gulfnews.com/northwind-dc" },
      ],
    },
  },
];

// ---- Match brief presets --------------------------------------------------

const strongMatch: MatchBriefData = {
  score: 88,
  dimensions: [
    { label: "Required skills", score: 92, note: "6 of 7 required skills present" },
    { label: "Preferred skills", score: 70, note: "3 of 5 preferred skills present" },
    { label: "Experience", score: 85, note: "Your 3 yrs fits the 2–4 yr band" },
    { label: "Role similarity", score: 90, note: "Close to your last two roles" },
    { label: "Location", score: 100, note: "Matches your remote scope" },
    { label: "Freshness", score: 95, note: "Verified 4h ago" },
  ],
  evidence: [
    "TypeScript, React and Node.js appear in your profile and the required list.",
    "Your 3 years of experience sits inside the stated 2–4 year band.",
  ],
  missing: ["Kubernetes is required but not on your profile."],
  ambiguous: ["The listing says 'GraphQL a plus' but does not indicate depth expected."],
  suggestions: ["Add a Kubernetes project or note to strengthen the required-skills match."],
};

const partialMatch: MatchBriefData = {
  score: 64,
  dimensions: [
    { label: "Required skills", score: 60, note: "3 of 6 required skills present" },
    { label: "Preferred skills", score: 40, note: "2 of 5 preferred skills present" },
    { label: "Experience", score: 55, note: "Listing wants 5+ yrs; you have 3" },
    { label: "Role similarity", score: 75, note: "Adjacent to your experience" },
    { label: "Location", score: 90, note: "Eligible for country-remote" },
    { label: "Freshness", score: 80, note: "Verified 1d ago" },
  ],
  evidence: ["Python and SQL match the required list."],
  missing: ["Airflow and dbt are required and not on your profile.", "The role asks for 5+ years; your profile shows 3."],
  ambiguous: ["'Cloud experience' is listed without naming a provider."],
  suggestions: ["Highlight any pipeline or ETL work to offset the missing tools."],
};

const noProfileMatch: MatchBriefData = {
  score: 0,
  dimensions: [],
  evidence: [],
  missing: [],
  ambiguous: ["We can't build a Match Brief yet — your profile has no skills or experience."],
  suggestions: ["Complete your profile to see why roles match you."],
};

// ---- Freshness presets ----------------------------------------------------

const freshTimeline: FreshnessEvent[] = [
  { kind: "published", at: "2026-09-01T08:00:00Z", note: "Posted on the company site" },
  { kind: "discovered", at: "2026-09-01T09:20:00Z", note: "Found by RoleBrief" },
  { kind: "verified", at: "2026-09-02T06:00:00Z", note: "Link still live" },
];

const agingTimeline: FreshnessEvent[] = [
  { kind: "published", at: "2026-08-06T08:00:00Z" },
  { kind: "discovered", at: "2026-08-06T12:00:00Z" },
  { kind: "verified", at: "2026-08-28T06:00:00Z" },
  { kind: "rechecked", at: "2026-09-01T06:00:00Z", note: "Still listed, no changes" },
];

const expiredTimeline: FreshnessEvent[] = [
  { kind: "published", at: "2026-07-10T08:00:00Z" },
  { kind: "discovered", at: "2026-07-10T14:00:00Z" },
  { kind: "verified", at: "2026-07-28T06:00:00Z" },
  { kind: "expired", at: "2026-08-30T06:00:00Z", note: "Listing removed from source" },
];

export const jobs: Job[] = [
  {
    slug: "senior-frontend-engineer-meridian",
    title: "Senior frontend engineer",
    companySlug: "meridian-labs",
    locations: ["Dubai, UAE", "Remote — worldwide"],
    workModel: "Remote",
    remoteEligibility: "worldwide",
    seniority: "Senior",
    employmentType: "Full-time",
    discipline: "Frontend",
    skills: ["TypeScript", "React", "Node.js", "GraphQL", "Testing"],
    salary: { text: "AED 28,000–36,000 / month", provided: true },
    source: "Company site",
    sourceUrl: "https://meridianlabs.dev/careers/senior-frontend",
    applyUrl: "https://meridianlabs.dev/apply/senior-frontend",
    freshness: freshTimeline,
    eligibility: {
      state: "eligible",
      reasons: [
        { label: "Open to worldwide remote", kind: "eligible" },
        { label: "Experience within band", kind: "eligible" },
        { label: "No work authorization requirement stated", kind: "eligible" },
      ],
    },
    match: strongMatch,
    reasons: ["Matches your React & TypeScript focus", "Worldwide remote", "Verified 4h ago"],
    description: {
      overview:
        "Meridian Labs is hiring a senior frontend engineer to lead the design-system and dashboard experience for our observability product. You'll work async-first with a distributed team across Dubai, Karachi and remote.",
      responsibilities: [
        "Own the component library and dashboard performance.",
        "Partner with design on data-dense, accessible interfaces.",
        "Mentor two mid-level engineers.",
      ],
      required: ["4+ years frontend", "TypeScript", "React", "Node.js", "Automated testing", "WCAG-aware UI", "Kubernetes exposure"],
      preferred: ["GraphQL", "Design systems", "Observability tooling", "Charting libraries", "Open-source work"],
      benefits: ["Worldwide remote", "Annual learning budget", "Home-office stipend", "Health cover"],
      workAuthorization: "The employer did not state a work-authorization requirement for remote hires.",
    },
  },
  {
    slug: "principal-platform-engineer-distributed-systems-observability-team-lead-role",
    // 80-character title fixture (spec §14.1)
    title: "Principal platform engineer — distributed systems & observability team lead",
    companySlug: "meridian-labs",
    locations: ["Dubai, UAE", "Abu Dhabi, UAE", "Karachi, Pakistan"],
    workModel: "Hybrid",
    remoteEligibility: "hybrid",
    seniority: "Principal",
    employmentType: "Full-time",
    discipline: "DevOps/Cloud",
    skills: ["Go", "Kubernetes", "Terraform", "AWS", "Observability"],
    salary: { text: "AED 42,000–52,000 / month", provided: true },
    source: "Company site",
    sourceUrl: "https://meridianlabs.dev/careers/principal-platform",
    applyUrl: "https://meridianlabs.dev/apply/principal-platform",
    freshness: agingTimeline,
    eligibility: {
      state: "check",
      reasons: [
        { label: "Hybrid — 2 days in Dubai or Abu Dhabi", kind: "check" },
        { label: "Seniority above your current band", kind: "check" },
      ],
    },
    match: partialMatch,
    reasons: ["Followed company", "Hiring momentum after Series B", "Multi-location"],
    description: {
      overview:
        "Lead the platform group that powers Meridian's ingestion and query layer. This is a hands-on principal role with hybrid attendance at a Gulf hub.",
      responsibilities: ["Set platform architecture direction.", "Own reliability targets.", "Coach the platform team."],
      required: ["8+ years", "Go", "Kubernetes", "Terraform", "AWS", "On-call leadership"],
      preferred: ["Multi-region systems", "Cost optimisation", "Open telemetry"],
      benefits: ["Relocation support", "Health cover", "Learning budget"],
      workAuthorization: "UAE work authorization required; the employer offers relocation support.",
    },
  },
  {
    slug: "backend-engineer-qamar",
    title: "Backend engineer (Node.js)",
    companySlug: "qamar-fintech",
    locations: ["Karachi, Pakistan"],
    workModel: "Hybrid",
    remoteEligibility: "region-limited",
    seniority: "Mid",
    employmentType: "Full-time",
    discipline: "Backend",
    skills: ["Node.js", "PostgreSQL", "Redis", "AWS"],
    salary: { text: "PKR 450,000–650,000 / month", provided: true },
    source: "Rozee.pk",
    sourceUrl: "https://rozee.pk/qamar-backend",
    applyUrl: "https://qamar.finance/apply/backend",
    freshness: freshTimeline,
    eligibility: {
      state: "conflict",
      reasons: [
        { label: "On-site in Karachi required 3 days/week", kind: "conflict" },
        { label: "Your profile is set to remote-only", kind: "conflict" },
      ],
    },
    match: strongMatch,
    reasons: ["Strong skills match", "Employer-provided salary", "Fresh — posted 1d ago"],
    description: {
      overview:
        "Join Qamar's payments core team building high-throughput transaction services. Hybrid role based in Karachi.",
      responsibilities: ["Build and operate payment APIs.", "Improve throughput and reliability.", "Work with compliance on audit trails."],
      required: ["3+ years backend", "Node.js", "PostgreSQL", "Message queues"],
      preferred: ["Fintech experience", "Redis", "Kafka"],
      benefits: ["Provident fund", "Health cover", "Annual bonus"],
      workAuthorization: "Open to candidates authorized to work in Pakistan.",
    },
  },
  {
    slug: "data-engineer-atlas",
    title: "Data engineer",
    companySlug: "atlas-health",
    locations: ["Remote — worldwide"],
    workModel: "Remote",
    remoteEligibility: "worldwide",
    seniority: "Mid",
    employmentType: "Full-time",
    discipline: "Data",
    skills: ["Python", "SQL", "Airflow", "dbt", "Snowflake"],
    salary: null, // no-salary fixture
    source: "Atlas careers",
    sourceUrl: "https://atlashealth.io/jobs/data-engineer",
    applyUrl: "https://atlashealth.io/apply/data-engineer",
    freshness: agingTimeline,
    eligibility: {
      state: "eligible",
      reasons: [
        { label: "Worldwide remote", kind: "eligible" },
        { label: "Employment type matches", kind: "eligible" },
      ],
    },
    match: partialMatch,
    reasons: ["Worldwide remote", "Adjacent to your data work", "Salary not provided"],
    description: {
      overview:
        "Atlas Health is hiring a data engineer to build clinical analytics pipelines in a fully async, worldwide-remote team.",
      responsibilities: ["Build and maintain ELT pipelines.", "Model clinical data for analytics.", "Support data quality checks."],
      required: ["3+ years data engineering", "Python", "SQL", "Airflow", "dbt", "Warehouse modelling"],
      preferred: ["Snowflake", "Healthcare data", "Great Expectations"],
      benefits: ["Worldwide remote", "Async-first", "Home-office stipend"],
      workAuthorization: "The employer did not specify a work-authorization requirement.",
    },
  },
  {
    slug: "mobile-engineer-flutter-qamar",
    title: "Mobile engineer (Flutter)",
    companySlug: "qamar-fintech",
    locations: ["Lahore, Pakistan", "Remote — Pakistan"],
    workModel: "Remote",
    remoteEligibility: "country-eligible",
    seniority: "Junior",
    employmentType: "Full-time",
    discipline: "Mobile",
    skills: ["Flutter", "Dart", "REST", "CI/CD"],
    salary: { text: "Competitive — level-based", provided: false }, // ambiguous salary fixture
    source: "LinkedIn",
    sourceUrl: "https://linkedin.com/jobs/qamar-flutter",
    applyUrl: "https://qamar.finance/apply/flutter",
    freshness: freshTimeline,
    eligibility: {
      state: "eligible",
      reasons: [
        { label: "Remote within Pakistan", kind: "eligible" },
        { label: "Junior band matches", kind: "eligible" },
      ],
    },
    match: {
      ...strongMatch,
      score: 79,
      missing: ["Native module experience is preferred but not on your profile."],
    },
    reasons: ["Good fit for graduates", "Country-remote (Pakistan)", "Salary shown as 'competitive'"],
    description: {
      overview: "Build Qamar's consumer wallet app in Flutter alongside a small, senior mobile team.",
      responsibilities: ["Ship features in the wallet app.", "Write widget and integration tests.", "Collaborate on design handoff."],
      required: ["1+ year mobile", "Flutter", "Dart", "REST APIs"],
      preferred: ["Native modules", "CI/CD", "App-store release experience"],
      benefits: ["Provident fund", "Health cover", "Device budget"],
      workAuthorization: "Open to candidates authorized to work in Pakistan.",
    },
  },
  {
    slug: "qa-automation-engineer-northwind",
    title: "QA automation engineer",
    companySlug: "northwind-cloud",
    locations: ["Abu Dhabi, UAE"],
    workModel: "On-site",
    remoteEligibility: "on-site",
    seniority: "Mid",
    employmentType: "Full-time",
    discipline: "QA/Testing",
    skills: ["Playwright", "TypeScript", "CI/CD"],
    salary: { text: "AED 18,000–24,000 / month", provided: true },
    source: "Bayt.com",
    sourceUrl: "https://bayt.com/northwind-qa",
    applyUrl: "https://northwind.cloud/apply/qa",
    freshness: agingTimeline,
    eligibility: {
      state: "unknown",
      reasons: [
        { label: "Remote eligibility not stated by employer", kind: "unknown" },
        { label: "Work authorization requirement unclear", kind: "unknown" },
      ],
    },
    match: partialMatch,
    reasons: ["On-site in Abu Dhabi", "Some data missing", "Verified 5d ago"],
    description: {
      overview: "Own end-to-end test automation for Northwind's cloud console. On-site role in Abu Dhabi.",
      responsibilities: ["Build Playwright suites.", "Integrate tests into CI.", "Report quality metrics."],
      required: ["3+ years QA", "Playwright or Cypress", "TypeScript"],
      preferred: ["Performance testing", "Cloud console testing"],
      benefits: ["Health cover", "Annual flights"],
      workAuthorization: "The employer did not specify — confirm before applying.",
    },
    flags: ["missing-data"],
  },
  {
    slug: "uiux-designer-atlas",
    title: "UI/UX designer (product)",
    companySlug: "atlas-health",
    locations: ["Remote — worldwide"],
    workModel: "Remote",
    remoteEligibility: "worldwide",
    seniority: "Mid",
    employmentType: "Contract",
    discipline: "UI/UX",
    skills: ["Figma", "Design systems", "Accessibility", "Prototyping"],
    salary: { text: "$45–65 / hour", provided: true },
    source: "Atlas careers",
    sourceUrl: "https://atlashealth.io/jobs/uiux",
    applyUrl: "https://atlashealth.io/apply/uiux",
    freshness: freshTimeline,
    eligibility: {
      state: "eligible",
      reasons: [
        { label: "Worldwide remote", kind: "eligible" },
        { label: "Contract type matches saved filter", kind: "eligible" },
      ],
    },
    match: { ...partialMatch, score: 71 },
    reasons: ["Worldwide remote", "Accessibility focus", "Contract role"],
    description: {
      overview: "Design accessible clinical workflows for Atlas's async, worldwide-remote team.",
      responsibilities: ["Own end-to-end product flows.", "Maintain the design system.", "Run usability sessions."],
      required: ["3+ years product design", "Figma", "Design systems", "WCAG knowledge"],
      preferred: ["Healthcare design", "Prototyping", "Research"],
      benefits: ["Worldwide remote", "Flexible hours"],
      workAuthorization: "Contract; the employer did not state authorization requirements.",
    },
  },
  {
    slug: "ml-engineer-meridian",
    title: "Machine learning engineer",
    companySlug: "meridian-labs",
    locations: ["Remote — worldwide"],
    workModel: "Remote",
    remoteEligibility: "worldwide",
    seniority: "Mid",
    employmentType: "Full-time",
    discipline: "AI/ML",
    skills: ["Python", "PyTorch", "MLOps", "AWS"],
    salary: { text: "AED 30,000–40,000 / month", provided: true },
    source: "Company site",
    sourceUrl: "https://meridianlabs.dev/careers/ml-engineer",
    applyUrl: "https://meridianlabs.dev/apply/ml-engineer",
    freshness: expiredTimeline,
    eligibility: {
      state: "eligible",
      reasons: [{ label: "Worldwide remote", kind: "eligible" }],
    },
    match: { ...partialMatch, score: 68 },
    reasons: ["Followed company", "Worldwide remote", "Listing expired"],
    description: {
      overview: "Build anomaly-detection models for Meridian's observability product.",
      responsibilities: ["Train and deploy detection models.", "Own the model lifecycle."],
      required: ["3+ years ML", "Python", "PyTorch", "MLOps"],
      preferred: ["Time-series", "Observability data"],
      benefits: ["Worldwide remote", "Learning budget"],
      workAuthorization: "The employer did not specify.",
    },
    flags: ["expired"],
  },
];

export const news: NewsItem[] = [
  {
    slug: "meridian-series-b-40m",
    headline: "Meridian Labs raises $40M Series B to expand Gulf engineering teams",
    publisher: "MENAbytes",
    publishedAt: "2026-08-28T09:00:00Z",
    category: "Funding",
    summary:
      "Meridian Labs closed a $40M Series B led by Gulf Capital, earmarked for platform and backend hiring across Dubai and remote.",
    keyFacts: [
      "Round size: $40M, led by Gulf Capital.",
      "Stated use: platform and backend hiring.",
      "New Karachi engineering hub opened in July.",
    ],
    companies: ["meridian-labs"],
    locations: ["Dubai, UAE", "Karachi, Pakistan"],
    hiringImpact: {
      label: "Likely more hiring",
      rationale: "Funding is explicitly tied to engineering headcount; treat specific role counts as inference.",
    },
    sourceUrl: "https://menabytes.com/meridian-series-b",
    relatedJobs: ["senior-frontend-engineer-meridian", "principal-platform-engineer-distributed-systems-observability-team-lead-role"],
    image: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&h=800&fit=crop&auto=format",
  },
  {
    slug: "qamar-support-reorg",
    headline: "Qamar Fintech restructures support, trims about 6% of roles",
    publisher: "Profit by Pakistan Today",
    publishedAt: "2026-08-22T09:00:00Z",
    category: "Layoffs",
    summary:
      "Qamar reorganised its customer-support function, reducing roughly 6% of positions while it says engineering hiring continues.",
    keyFacts: ["~6% of roles affected, mostly in support.", "Company states engineering hiring is unaffected."],
    companies: ["qamar-fintech"],
    locations: ["Karachi, Pakistan"],
    hiringImpact: {
      label: "Mixed signal",
      rationale: "Cuts were in support, not engineering, but overall direction is uncertain — read alongside open roles.",
    },
    sourceUrl: "https://profit.pakistantoday.com.pk/qamar-reorg",
    relatedJobs: ["backend-engineer-qamar", "mobile-engineer-flutter-qamar"],
  },
  {
    slug: "uae-golden-visa-tech",
    headline: "UAE widens Golden Visa criteria for senior technology professionals",
    publisher: "Gulf News",
    publishedAt: "2026-08-15T09:00:00Z",
    category: "Visa & policy",
    summary:
      "The UAE expanded long-term residency eligibility to more technology roles, which may ease relocation for senior hires.",
    keyFacts: ["Broader eligibility for senior tech roles.", "10-year residency pathway."],
    companies: ["meridian-labs", "northwind-cloud"],
    locations: ["Dubai, UAE", "Abu Dhabi, UAE"],
    hiringImpact: {
      label: "Likely more hiring",
      rationale: "Easier relocation can widen the talent pool for UAE-based roles; effect on any single employer is unclear.",
    },
    sourceUrl: "https://gulfnews.com/uae-golden-visa-tech",
    relatedJobs: ["principal-platform-engineer-distributed-systems-observability-team-lead-role"],
    image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1200&h=800&fit=crop&auto=format",
  },
  {
    slug: "atlas-remote-reaffirm",
    headline: "Atlas Health reaffirms worldwide-remote hiring for engineering",
    publisher: "Company blog",
    publishedAt: "2026-08-12T09:00:00Z",
    category: "Remote policy",
    summary: "Atlas Health restated its worldwide-remote, async-first hiring policy across engineering and design.",
    keyFacts: ["Worldwide-remote confirmed.", "Async-first working model."],
    companies: ["atlas-health"],
    locations: ["Remote — worldwide"],
    hiringImpact: {
      label: "Unclear",
      rationale: "Policy reaffirmation does not indicate role volume.",
    },
    sourceUrl: "https://atlashealth.io/handbook",
    relatedJobs: ["data-engineer-atlas", "uiux-designer-atlas"],
  },
  {
    slug: "pakistan-grad-program-trend",
    headline: "Graduate engineering programs expand across Pakistani startups",
    publisher: "TechInAsia",
    publishedAt: "2026-08-08T09:00:00Z",
    category: "Graduate programs",
    summary:
      "Several Pakistani technology companies announced structured graduate programs for 2026, focused on backend and mobile.",
    keyFacts: ["Multiple new graduate tracks announced.", "Focus areas: backend, mobile, QA."],
    companies: ["qamar-fintech"],
    locations: ["Karachi, Pakistan", "Lahore, Pakistan"],
    hiringImpact: {
      label: "Likely more hiring",
      rationale: "Graduate programs signal junior openings; specific counts are not disclosed.",
    },
    sourceUrl: "https://techinasia.com/pakistan-grad-programs",
    relatedJobs: ["mobile-engineer-flutter-qamar"],
  },
];

// ---- Application tracker ---------------------------------------------------

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

export const trackerItems: TrackerItem[] = [
  {
    id: "t1",
    jobSlug: "senior-frontend-engineer-meridian",
    status: "Interview",
    updatedAt: "2026-08-30T10:00:00Z",
    source: "Company site",
    resumeVersion: "Frontend — v3",
    nextAction: "Prepare system-design round",
    reminderAt: "2026-09-04T09:00:00Z",
    history: [
      { status: "Saved", at: "2026-08-20T10:00:00Z" },
      { status: "Applied", at: "2026-08-22T10:00:00Z" },
      { status: "Interview", at: "2026-08-30T10:00:00Z" },
    ],
    notes: "Recruiter: Sana. Panel is async-friendly.",
  },
  {
    id: "t2",
    jobSlug: "data-engineer-atlas",
    status: "Applied",
    updatedAt: "2026-08-27T10:00:00Z",
    source: "Atlas careers",
    resumeVersion: "Data — v2",
    nextAction: "Follow up if no reply by 5 Sep",
    history: [
      { status: "Saved", at: "2026-08-24T10:00:00Z" },
      { status: "Applied", at: "2026-08-27T10:00:00Z" },
    ],
  },
  {
    id: "t3",
    jobSlug: "backend-engineer-qamar",
    status: "Saved",
    updatedAt: "2026-09-01T10:00:00Z",
    source: "Rozee.pk",
    nextAction: "Resolve on-site conflict before applying",
    history: [{ status: "Saved", at: "2026-09-01T10:00:00Z" }],
  },
  {
    id: "t4",
    jobSlug: "ml-engineer-meridian",
    status: "Rejected",
    updatedAt: "2026-08-18T10:00:00Z",
    source: "Company site",
    resumeVersion: "ML — v1",
    history: [
      { status: "Applied", at: "2026-08-05T10:00:00Z" },
      { status: "Rejected", at: "2026-08-18T10:00:00Z" },
    ],
    notes: "Role later expired.",
  },
];

// ---- Saved searches & alerts ----------------------------------------------

export interface SavedSearch {
  id: string;
  name: string;
  criteria: string[];
  frequency: "Instant" | "Daily" | "Weekly";
  expectedVolume: string;
  lastMatch: string;
  paused?: boolean;
}

export const savedSearches: SavedSearch[] = [
  {
    id: "s1",
    name: "Remote React roles",
    criteria: ["React", "Worldwide remote", "Mid–Senior", "Full-time"],
    frequency: "Daily",
    expectedVolume: "~6 / week",
    lastMatch: "2026-09-01T08:00:00Z",
  },
  {
    id: "s2",
    name: "Karachi backend",
    criteria: ["Node.js", "Karachi", "Employer-provided salary"],
    frequency: "Weekly",
    expectedVolume: "~3 / week",
    lastMatch: "2026-08-29T08:00:00Z",
    paused: true,
  },
];

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

export const alerts: Alert[] = [
  {
    id: "a1",
    name: "Worldwide remote frontend",
    chips: ["Frontend", "Worldwide remote", "React", "Senior"],
    cadence: "Daily",
    channels: ["In-app", "Email"],
    status: "Active",
    volume: "~5 / week",
    lastSent: "2026-09-02T06:00:00Z",
  },
  {
    id: "a2",
    name: "UAE data roles",
    chips: ["Data", "UAE", "Employer-provided salary"],
    cadence: "Weekly",
    channels: ["In-app"],
    status: "Paused",
    volume: "~2 / week",
  },
];

// ---- Lookups --------------------------------------------------------------

export function getCompany(slug: string): Company | undefined {
  return companies.find((c) => c.slug === slug);
}
export function getJob(slug: string): Job | undefined {
  return jobs.find((j) => j.slug === slug);
}
export function getNews(slug: string): NewsItem | undefined {
  return news.find((n) => n.slug === slug);
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
