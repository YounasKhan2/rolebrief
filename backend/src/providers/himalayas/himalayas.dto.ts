import { z } from "zod";

export const himalayasLocationObjectSchema = z.object({
  alpha2: z.string().min(1).optional().nullable(),
  name: z.string().min(1),
  slug: z.string().min(1)
});

export const himalayasLocationSchema = z.union([z.string().min(1), himalayasLocationObjectSchema]);

export const himalayasJobSchema = z.object({
  title: z.string().min(1),
  excerpt: z.string().optional().nullable(),
  companyName: z.string().min(1),
  companySlug: z.string().min(1),
  companyLogo: z.string().url().optional().nullable(),
  employmentType: z.string().optional().nullable(),
  minSalary: z.number().nullable().optional(),
  maxSalary: z.number().nullable().optional(),
  salaryPeriod: z.string().optional().nullable(),
  seniority: z.union([z.string(), z.array(z.string())]).optional().nullable(),
  currency: z.string().optional().nullable(),
  locationRestrictions: z.array(himalayasLocationSchema).default([]),
  timezoneRestrictions: z.array(z.union([z.string(), z.number()])).default([]),
  categories: z.array(z.string()).default([]),
  parentCategories: z.array(z.string()).default([]),
  description: z.string().optional().nullable(),
  pubDate: z.union([z.string(), z.number()]).optional().nullable(),
  expiryDate: z.union([z.string(), z.number()]).optional().nullable(),
  applicationLink: z.string().url(),
  guid: z.string().min(1)
});

export const himalayasResponseSchema = z.object({
  updatedAt: z.union([z.string(), z.number()]).optional(),
  nextCursor: z.string().optional().nullable(),
  offset: z.number().optional(),
  limit: z.number().optional(),
  totalCount: z.number().optional(),
  jobs: z.array(himalayasJobSchema)
});

export type HimalayasJobDto = z.infer<typeof himalayasJobSchema>;
export type HimalayasResponseDto = z.infer<typeof himalayasResponseSchema>;
