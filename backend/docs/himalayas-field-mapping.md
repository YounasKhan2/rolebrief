# Himalayas Field Mapping

Source: `https://himalayas.app/jobs/api`

The provider is disabled by default with `HIMALAYAS_ENABLED=false`. When disabled, RoleBrief does not schedule Himalayas ingestion jobs and the ingestion service returns before fetching HTTP pages.

## Mapping

| Himalayas field | RoleBrief field |
| --- | --- |
| `guid` | `ProviderRecord.externalId`, dedupe key |
| `title` | `Job.canonicalTitle` |
| `companyName` | `Company.canonicalName` |
| `companySlug` | `Company.slug` |
| `companyLogo` | `Company.logoUrl` |
| `employmentType` | `Job.employmentType` |
| `seniority` | `Job.seniority` |
| `description` | `Job.descriptionHtml`, stripped into `Job.descriptionText` |
| `pubDate` | `Job.publishedAt`, `ProviderRecord.providerPublishedAt` |
| `expiryDate` | `Job.expiresAt`; expired dates mark jobs `EXPIRED` |
| `applicationLink` | `ProviderRecord.applicationUrl`, source URL |
| `locationRestrictions` | `Location` plus `JobLocation`; empty means worldwide |
| `timezoneRestrictions` | `Job.remoteRestrictions.timezones` |
| `categories`, `parentCategories` | `Job.requiredSkills` and search document terms |
| `minSalary`, `maxSalary`, `currency`, `salaryPeriod` | `Salary` with source `himalayas` |

## Unsupported Or Missing

Himalayas does not provide stable company domain, visa authorization, full skill taxonomy, moderation evidence, recruiter identity, or direct ATS metadata. These remain null, empty, or inferred only from RoleBrief-owned verification phases.

The public docs describe `locationRestrictions` as objects and `timezoneRestrictions` as strings, while live responses can currently return location names and numeric timezone offsets. The DTO accepts both shapes and normalizes them into RoleBrief-owned strings/locations.

Pagination uses opaque `nextCursor` values exactly as returned. The adapter caps `limit` at 20 to match the documented provider maximum, retries transient failures, delays on `429`, and records partial failures on the ingestion run.
