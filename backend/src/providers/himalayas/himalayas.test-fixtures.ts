import { HimalayasJobDto, HimalayasResponseDto } from "./himalayas.dto";

export function sampleHimalayasJob(overrides: Partial<HimalayasJobDto> = {}): HimalayasJobDto {
  return {
    title: "Senior Engineer",
    excerpt: "Build useful systems.",
    companyName: "Acme",
    companySlug: "acme",
    companyLogo: "https://cdn-images.himalayas.app/acme-logo",
    employmentType: "Full Time",
    minSalary: null,
    maxSalary: null,
    salaryPeriod: "annual",
    seniority: ["Senior"],
    currency: "USD",
    locationRestrictions: [{ alpha2: "US", name: "United States", slug: "united-states" }],
    timezoneRestrictions: ["-8", "-5"],
    categories: ["Engineering"],
    parentCategories: ["Software Development"],
    description: "<h3>About the role</h3><p>Hello <strong>team</strong></p>",
    pubDate: 1_788_548_400_000,
    expiryDate: 1_793_736_000_000,
    applicationLink: "https://himalayas.app/jobs/acme-senior-engineer",
    guid: "guid-1",
    ...overrides
  };
}

export function sampleHimalayasResponse(overrides: Partial<HimalayasResponseDto> = {}): HimalayasResponseDto {
  return {
    updatedAt: 1_788_548_400_000,
    nextCursor: null,
    offset: 0,
    limit: 20,
    totalCount: 1,
    jobs: [sampleHimalayasJob()],
    ...overrides
  };
}
