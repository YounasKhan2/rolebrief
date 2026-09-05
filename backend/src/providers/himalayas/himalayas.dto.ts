import { z } from "zod";

export const himalayasLocationObjectSchema = z.object({
  alpha2: z.string().min(1).nullable().optional(),
  name: z.string().min(1),
  slug: z.string().min(1)
});
const locationRestrictionSchema = z.union([himalayasLocationObjectSchema, z.string().min(1)]);

const employmentTypeSchema = z.enum(["Full Time", "Part Time", "Contractor", "Temporary", "Intern", "Volunteer", "Other"]);
const salaryPeriodSchema = z.enum(["hourly", "weekly", "fortnightly", "monthly", "annual"]);
const senioritySchema = z.enum(["Entry-level", "Mid-level", "Senior", "Manager", "Director", "Executive"]);
const timestampMsSchema = z.number().int().nonnegative();

export const himalayasJobSchema = z.object({
  title: z.string().min(1),
  excerpt: z.string(),
  companyName: z.string().min(1),
  companySlug: z.string().min(1),
  companyLogo: z.string().nullable().optional(),
  employmentType: employmentTypeSchema,
  minSalary: z.number().nullable(),
  maxSalary: z.number().nullable(),
  salaryPeriod: salaryPeriodSchema.default("annual"),
  seniority: z.array(senioritySchema),
  currency: z.string().length(3).nullable(),
  locationRestrictions: z.array(locationRestrictionSchema),
  timezoneRestrictions: z.array(z.union([z.string(), z.number()])),
  categories: z.array(z.string()),
  parentCategories: z.array(z.string()),
  description: z.string(),
  pubDate: timestampMsSchema,
  expiryDate: timestampMsSchema,
  applicationLink: z.string().url(),
  guid: z.string().min(1)
});

export const himalayasResponseSchema = z.object({
  updatedAt: timestampMsSchema,
  nextCursor: z.string().optional().nullable(),
  offset: z.number().int().nonnegative(),
  limit: z.number().int().min(1).max(20),
  totalCount: z.number().int().nonnegative(),
  jobs: z.array(himalayasJobSchema)
});

export type HimalayasJobDto = z.infer<typeof himalayasJobSchema>;
export type HimalayasResponseDto = z.infer<typeof himalayasResponseSchema>;
