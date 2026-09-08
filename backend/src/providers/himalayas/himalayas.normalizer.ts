import { createHash } from "node:crypto";
import { WorkMode } from "@prisma/client";
import { CountryResolverService } from "../../common/country/country-resolver.service";
import { CanonicalJobInput, CanonicalRemoteRestrictions } from "../provider-adapter";
import { HimalayasJobDto } from "./himalayas.dto";

const defaultCountryResolver = new CountryResolverService();

export function normalizeHimalayasJob(
  job: HimalayasJobDto,
  countryResolver: CountryResolverService = defaultCountryResolver
): CanonicalJobInput<HimalayasJobDto> {
  const seniority = job.seniority.length > 0 ? job.seniority.join(", ") : null;
  const { countries, countryCodes, labels, unresolvedLabels } = normalizeLocationRestrictions(
    job.locationRestrictions,
    countryResolver
  );
  const timezones = job.timezoneRestrictions.map((timezone) => String(timezone));
  const timezoneOffsetMinutes = normalizeTimezoneOffsetMinutes(job.timezoneRestrictions);
  const remote = normalizeRemoteRestrictions(
    countries,
    countryCodes,
    labels,
    unresolvedLabels,
    timezones,
    timezoneOffsetMinutes
  );
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

export function normalizeTimezoneOffsetMinutes(timezoneRestrictions: (string | number)[]): number[] {
  const offsets: number[] = [];
  for (const tz of timezoneRestrictions) {
    const num = typeof tz === "number" ? tz : parseFloat(tz);
    if (!Number.isNaN(num)) {
      offsets.push(Math.round(num * 60));
    }
  }
  return Array.from(new Set(offsets)).sort((a, b) => a - b);
}

export function normalizeRemoteRestrictions(
  countries: { alpha2: string | null; name: string; slug: string }[],
  countryCodes: string[],
  labels: string[],
  unresolvedLabels: string[],
  timezones: string[],
  timezoneOffsetMinutes: number[]
): CanonicalRemoteRestrictions {
  const hasCountries = countryCodes.length > 0 || labels.length > 0 || unresolvedLabels.length > 0;
  const hasTimezones = timezoneOffsetMinutes.length > 0 || timezones.length > 0;
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
    countryCodes,
    labels,
    unresolvedLabels,
    timezones,
    timezoneOffsetMinutes,
    provider: "himalayas.guid"
  };
}

export function normalizeLocationRestrictions(
  restrictions: HimalayasJobDto["locationRestrictions"],
  resolver: CountryResolverService
) {
  const countries: { alpha2: string | null; name: string; slug: string }[] = [];
  const countryCodes: string[] = [];
  const labels: string[] = [];
  const unresolvedLabels: string[] = [];

  for (const restriction of restrictions) {
    if (typeof restriction === "string") {
      const res = resolver.resolve(restriction);
      if (res.status === "RESOLVED" || res.status === "ALIAS_RESOLVED") {
        countryCodes.push(res.alpha2!);
        labels.push(res.canonicalLabel!);
        countries.push({
          alpha2: res.alpha2,
          name: res.canonicalLabel!,
          slug: slugify(res.canonicalLabel!)
        });
      } else {
        const trimmed = res.normalizedLabel || restriction.trim();
        if (trimmed) {
          unresolvedLabels.push(trimmed);
          labels.push(trimmed);
        }
      }
      continue;
    }

    if (restriction.alpha2) {
      const res = resolver.resolve(restriction.alpha2);
      if (res.status === "RESOLVED" || res.status === "ALIAS_RESOLVED") {
        countryCodes.push(res.alpha2!);
        const canonicalName = res.canonicalLabel ?? restriction.name;
        labels.push(canonicalName);
        countries.push({
          alpha2: res.alpha2,
          name: canonicalName,
          slug: restriction.slug
        });
      } else {
        const resByName = resolver.resolve(restriction.name);
        if (resByName.status === "RESOLVED" || resByName.status === "ALIAS_RESOLVED") {
          countryCodes.push(resByName.alpha2!);
          labels.push(resByName.canonicalLabel!);
          countries.push({
            alpha2: resByName.alpha2,
            name: resByName.canonicalLabel!,
            slug: restriction.slug
          });
        } else {
          unresolvedLabels.push(restriction.name);
          labels.push(restriction.name);
          countries.push({
            alpha2: null,
            name: restriction.name,
            slug: restriction.slug
          });
        }
      }
    } else {
      const resByName = resolver.resolve(restriction.name);
      if (resByName.status === "RESOLVED" || resByName.status === "ALIAS_RESOLVED") {
        countryCodes.push(resByName.alpha2!);
        labels.push(resByName.canonicalLabel!);
        countries.push({
          alpha2: resByName.alpha2,
          name: resByName.canonicalLabel!,
          slug: restriction.slug
        });
      } else {
        unresolvedLabels.push(restriction.name);
        labels.push(restriction.name);
        countries.push({
          alpha2: null,
          name: restriction.name,
          slug: restriction.slug
        });
      }
    }
  }

  const uniqueCountryCodes = Array.from(new Set(countryCodes)).sort();
  const uniqueLabels = Array.from(new Set(labels));
  const uniqueUnresolved = Array.from(new Set(unresolvedLabels));
  const uniqueCountries: { alpha2: string | null; name: string; slug: string }[] = [];
  const seenCountryKeys = new Set<string>();

  for (const c of countries) {
    const key = c.alpha2 ?? c.name;
    if (!seenCountryKeys.has(key)) {
      seenCountryKeys.add(key);
      uniqueCountries.push(c);
    }
  }

  return {
    countries: uniqueCountries,
    countryCodes: uniqueCountryCodes,
    labels: uniqueLabels,
    unresolvedLabels: uniqueUnresolved
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
