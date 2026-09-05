import { createHash } from "node:crypto";
import { WorkMode } from "@prisma/client";
import { CanonicalJobInput, CanonicalRemoteRestrictions } from "../provider-adapter";
import { HimalayasJobDto } from "./himalayas.dto";

export function normalizeHimalayasJob(job: HimalayasJobDto): CanonicalJobInput<HimalayasJobDto> {
  const seniority = job.seniority.length > 0 ? job.seniority.join(", ") : null;
  const { locations, locationLabels } = normalizeLocationRestrictions(job.locationRestrictions);
  const timezoneRestrictions = job.timezoneRestrictions.map((timezone) => String(timezone));
  const remote = normalizeRemoteRestrictions(locations, locationLabels, timezoneRestrictions);
  const sourcePublishedAt = parseProviderDate(job.pubDate);
  const providerExpiresAt = parseProviderDate(job.expiryDate);
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
  const applicationDomain = hostname(job.applicationLink);
  const canonicalFingerprint = hash(
    [slugify(job.companySlug), slugify(job.title), remote.scope, remote.countryCodes.join(","), remote.labels.join(","), applicationDomain].join("|")
  );

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
    remote,
    sourcePublishedAt,
    sourceUpdatedAt: sourcePublishedAt,
    providerExpiresAt,
    applicationDeadlineAt: null,
    applicationUrl: job.applicationLink,
    sourceUrl: job.applicationLink,
    contentHash,
    canonicalFingerprint,
    categories: job.categories,
    parentCategories: job.parentCategories,
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

function normalizeRemoteRestrictions(
  countries: { alpha2: string | null; name: string; slug: string }[],
  labels: string[],
  timezones: string[]
): CanonicalRemoteRestrictions {
  const hasCountries = countries.length > 0 || labels.length > 0;
  const hasTimezones = timezones.length > 0;
  const scope = hasCountries && hasTimezones
    ? "COUNTRY_AND_TIMEZONE_LIMITED"
    : hasCountries
      ? "COUNTRY_LIMITED"
      : hasTimezones
        ? "TIMEZONE_LIMITED"
        : "WORLDWIDE";

  return {
    scope,
    countries,
    countryCodes: countries.map((country) => country.alpha2).filter((alpha2): alpha2 is string => Boolean(alpha2)),
    labels,
    timezones
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

function hostname(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
