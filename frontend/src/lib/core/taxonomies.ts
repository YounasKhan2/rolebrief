export interface CountryOption {
  code: string;
  name: string;
}

export const COMMON_COUNTRIES: CountryOption[] = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "DE", name: "Germany" },
  { code: "PK", name: "Pakistan" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "NL", name: "Netherlands" },
  { code: "FR", name: "France" },
  { code: "SG", name: "Singapore" },
  { code: "AU", name: "Australia" },
  { code: "IE", name: "Ireland" },
  { code: "IN", name: "India" }
];

export const CURATED_DISCIPLINES = [
  "Software Engineering",
  "Frontend Engineering",
  "Backend Engineering",
  "Platform & DevOps",
  "Data & AI",
  "Product Design",
  "Engineering Management"
];

export const CURATED_SKILLS = [
  "TypeScript",
  "React",
  "Node.js",
  "Python",
  "PostgreSQL",
  "Go",
  "Rust",
  "AWS",
  "Kubernetes",
  "GraphQL",
  "Docker",
  "Redis"
];

export interface TaxonomyOption<T = string> {
  value: T;
  label: string;
}

export const SENIORITY_OPTIONS: TaxonomyOption[] = [
  { value: "ENTRY", label: "Entry-level" },
  { value: "MID", label: "Mid-level" },
  { value: "SENIOR", label: "Senior" },
  { value: "LEAD", label: "Lead" },
  { value: "PRINCIPAL", label: "Principal / Staff" },
  { value: "DIRECTOR", label: "Director" },
  { value: "EXECUTIVE", label: "Executive / VP" }
];

export const EMPLOYMENT_TYPE_OPTIONS: TaxonomyOption[] = [
  { value: "FULL_TIME", label: "Full-time" },
  { value: "CONTRACT", label: "Contract" },
  { value: "PART_TIME", label: "Part-time" },
  { value: "INTERNSHIP", label: "Internship" },
  { value: "TEMPORARY", label: "Temporary" }
];

export const SEARCH_STATUS_OPTIONS: TaxonomyOption[] = [
  { value: "ACTIVELY_LOOKING", label: "Actively looking" },
  { value: "OPEN_TO_OFFERS", label: "Open to offers" },
  { value: "CASUAL", label: "Casual browsing" },
  { value: "NOT_LOOKING", label: "Not looking" }
];

export const RELOCATION_OPTIONS: TaxonomyOption[] = [
  { value: "NOT_OPEN", label: "No Relocation" },
  { value: "WILLING_TO_RELOCATE", label: "Willing to relocate" },
  { value: "OPEN_TO_REMOTE_ONLY", label: "Remote Only" }
];

export const REMOTE_OPTIONS: TaxonomyOption[] = [
  { value: "REMOTE_ONLY", label: "Remote Only" },
  { value: "HYBRID", label: "Hybrid" },
  { value: "ONSITE", label: "On-site" },
  { value: "OPEN_TO_ANY", label: "Open to Any" }
];

export const SPONSORSHIP_OPTIONS: TaxonomyOption[] = [
  { value: "NO", label: "Not needed" },
  { value: "YES", label: "Required" },
  { value: "NOT_DECLARED", label: "Not declared" }
];
