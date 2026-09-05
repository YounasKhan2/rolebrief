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
  remoteRestrictions: {
    countries: { alpha2: string | null; name: string; slug: string }[];
    labels: string[];
    timezones: string[];
  };
  publishedAt: Date | null;
  expiresAt: Date | null;
  applicationUrl: string;
  sourceUrl: string;
  contentHash: string;
  categories: string[];
  parentCategories: string[];
  locations: { alpha2: string | null; name: string; slug: string }[];
  salary: { min: number | null; max: number | null; currency: string | null; period: string | null } | null;
  raw: HimalayasJobDto;
}

export function normalizeHimalayasJob(job: HimalayasJobDto): NormalizedHimalayasJob {
  const seniority = job.seniority.length > 0 ? job.seniority.join(", ") : null;
  const { locations, locationLabels } = normalizeLocationRestrictions(job.locationRestrictions);
  const timezoneRestrictions = job.timezoneRestrictions.map((timezone) => String(timezone));
  const contentHash = hash(
    JSON.stringify({
      title: job.title,
      excerpt: job.excerpt,
      companyName: job.companyName,
      companySlug: job.companySlug,
      companyLogo: job.companyLogo,
      employmentType: job.employmentType,
      minSalary: job.minSalary,
      maxSalary: job.maxSalary,
      salaryPeriod: job.salaryPeriod,
      seniority: job.seniority,
      currency: job.currency,
      locationRestrictions: job.locationRestrictions,
      timezoneRestrictions: job.timezoneRestrictions,
      categories: job.categories,
      parentCategories: job.parentCategories,
      description: job.description,
      pubDate: job.pubDate,
      expiryDate: job.expiryDate,
      applicationLink: job.applicationLink
    })
  );
  const slug = `${slugify(job.companySlug)}-${hash(job.guid).slice(0, 12)}`;

  return {
    externalId: job.guid,
    slug,
    title: job.title,
    companySlug: slugify(job.companySlug),
    companyName: job.companyName,
    companyLogo: job.companyLogo ?? null,
    descriptionHtml: job.description,
    descriptionText: stripHtml(job.excerpt || job.description),
    employmentType: job.employmentType ?? null,
    seniority,
    workMode: WorkMode.REMOTE,
    remoteScope: locations.length === 0 ? "worldwide" : "restricted",
    remoteRestrictions: {
      countries: locations,
      labels: locationLabels,
      timezones: timezoneRestrictions
    },
    publishedAt: parseProviderDate(job.pubDate),
    expiresAt: parseProviderDate(job.expiryDate),
    applicationUrl: job.applicationLink,
    sourceUrl: job.applicationLink,
    contentHash,
    categories: job.categories,
    parentCategories: job.parentCategories,
    locations,
    salary:
      job.minSalary !== null || job.maxSalary !== null
        ? {
            min: job.minSalary ?? null,
            max: job.maxSalary ?? null,
            currency: job.currency ?? null,
            period: job.salaryPeriod
          }
        : null,
    raw: job
  };
}

function normalizeLocationRestrictions(restrictions: HimalayasJobDto["locationRestrictions"]) {
  const locations: { alpha2: string | null; name: string; slug: string }[] = [];
  const locationLabels: string[] = [];

  for (const restriction of restrictions) {
    if (typeof restriction === "string") {
      locationLabels.push(restriction);
      continue;
    }

    locations.push({
      alpha2: restriction.alpha2 ?? null,
      name: restriction.name,
      slug: restriction.slug
    });
  }

  return { locations, locationLabels };
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
