import { createHash } from "node:crypto";
import { JobStatus, WorkMode } from "@prisma/client";
import { HimalayasJobDto } from "./himalayas.dto";

export interface NormalizedHimalayasJob {
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
  workMode: WorkMode;
  remoteScope: string;
  remoteRestrictions: Record<string, unknown>;
  publishedAt: Date | null;
  expiresAt: Date | null;
  applicationUrl: string;
  sourceUrl: string;
  contentHash: string;
  categories: string[];
  locations: { alpha2: string | null; name: string; slug: string }[];
  salary: { min: number | null; max: number | null; currency: string | null; period: string | null } | null;
  raw: HimalayasJobDto;
}

export function normalizeHimalayasJob(job: HimalayasJobDto): NormalizedHimalayasJob {
  const seniority = Array.isArray(job.seniority) ? job.seniority.join(", ") : job.seniority ?? null;
  const locations = job.locationRestrictions.map((location) =>
    typeof location === "string"
      ? { alpha2: null, name: location, slug: slugify(location) }
      : {
          alpha2: location.alpha2 ?? null,
          name: location.name,
          slug: location.slug
        }
  );
  const contentHash = hash([job.guid, job.title, job.companySlug, job.description ?? "", job.pubDate ?? ""].join("|"));
  const slug = `${slugify(job.companySlug)}-${slugify(job.title)}-${contentHash.slice(0, 8)}`;

  return {
    externalId: job.guid,
    slug,
    title: job.title,
    companySlug: slugify(job.companySlug),
    companyName: job.companyName,
    companyLogo: job.companyLogo ?? null,
    descriptionHtml: job.description ?? null,
    descriptionText: stripHtml(job.description ?? job.excerpt ?? ""),
    employmentType: job.employmentType ?? null,
    seniority,
    workMode: WorkMode.REMOTE,
    remoteScope: locations.length === 0 ? "worldwide" : "restricted",
    remoteRestrictions: {
      countries: locations,
      timezones: job.timezoneRestrictions.map(String)
    },
    publishedAt: parseProviderDate(job.pubDate),
    expiresAt: parseProviderDate(job.expiryDate),
    applicationUrl: job.applicationLink,
    sourceUrl: job.applicationLink,
    contentHash,
    categories: [...job.categories, ...job.parentCategories],
    locations,
    salary:
      job.minSalary || job.maxSalary
        ? {
            min: job.minSalary ?? null,
            max: job.maxSalary ?? null,
            currency: job.currency ?? null,
            period: job.salaryPeriod ?? "annual"
          }
        : null,
    raw: job
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || null;
}

function parseProviderDate(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  const date = typeof value === "number" ? new Date(value < 1_000_000_000_000 ? value * 1000 : value) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
