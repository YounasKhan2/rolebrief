import "reflect-metadata";
import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min
} from "class-validator";
import { JobStatus, WorkMode } from "@prisma/client";

export enum JobSortOption {
  NEWEST = "newest",
  RECENTLY_UPDATED = "recentlyUpdated",
  DEADLINE_SOON = "deadlineSoon",
  SALARY_HIGH = "salaryHigh",
  SALARY_LOW = "salaryLow",
  TITLE_AZ = "titleAZ",
  RELEVANCE = "relevance"
}

export enum RemoteScopeEnum {
  WORLDWIDE = "WORLDWIDE",
  COUNTRY_LIMITED = "COUNTRY_LIMITED",
  TIMEZONE_LIMITED = "TIMEZONE_LIMITED",
  COUNTRY_AND_TIMEZONE_LIMITED = "COUNTRY_AND_TIMEZONE_LIMITED",
  UNKNOWN = "UNKNOWN"
}

function parseArrayOrString(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => String(item).split(","))
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return undefined;
}

export class JobsQueryDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  q?: string;

  @IsOptional()
  @Transform(({ value }) => parseArrayOrString(value))
  @IsArray()
  @IsString({ each: true })
  country?: string[];

  @IsOptional()
  @Transform(({ value }) => parseArrayOrString(value))
  @IsArray()
  @IsString({ each: true })
  remoteScope?: string[];

  @IsOptional()
  @Transform(({ value }) => parseArrayOrString(value))
  @IsArray()
  @IsString({ each: true })
  workMode?: string[];

  @IsOptional()
  @Transform(({ value }) => parseArrayOrString(value))
  @IsArray()
  @IsString({ each: true })
  timezone?: string[];

  @IsOptional()
  @Transform(({ value }) => parseArrayOrString(value))
  @IsArray()
  @IsString({ each: true })
  seniority?: string[];

  @IsOptional()
  @Transform(({ value }) => parseArrayOrString(value))
  @IsArray()
  @IsString({ each: true })
  employmentType?: string[];

  @IsOptional()
  @Transform(({ value }) => parseArrayOrString(value))
  @IsArray()
  @IsString({ each: true })
  category?: string[];

  @IsOptional()
  @Transform(({ value }) => parseArrayOrString(value))
  @IsArray()
  @IsString({ each: true })
  company?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salaryMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salaryMax?: number;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toUpperCase() : value))
  currency?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  salaryPeriod?: string;

  @IsOptional()
  @IsISO8601()
  publishedAfter?: string;

  @IsOptional()
  @IsISO8601()
  deadlineBefore?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  provider?: string;

  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;

  @IsOptional()
  @IsEnum(JobSortOption)
  sort?: JobSortOption;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  // Optional exclusions
  @IsOptional()
  @Transform(({ value }) => parseArrayOrString(value))
  @IsArray()
  @IsString({ each: true })
  excludeCategory?: string[];

  @IsOptional()
  @Transform(({ value }) => parseArrayOrString(value))
  @IsArray()
  @IsString({ each: true })
  excludeWorkMode?: string[];

  @IsOptional()
  @Transform(({ value }) => parseArrayOrString(value))
  @IsArray()
  @IsString({ each: true })
  excludeSeniority?: string[];
}

export class JobFacetsQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Transform(({ value }) => parseArrayOrString(value))
  country?: string[];

  @IsOptional()
  @Transform(({ value }) => parseArrayOrString(value))
  remoteScope?: string[];

  @IsOptional()
  @Transform(({ value }) => parseArrayOrString(value))
  workMode?: string[];

  @IsOptional()
  @Transform(({ value }) => parseArrayOrString(value))
  seniority?: string[];

  @IsOptional()
  @Transform(({ value }) => parseArrayOrString(value))
  employmentType?: string[];

  @IsOptional()
  @Transform(({ value }) => parseArrayOrString(value))
  category?: string[];
}

export class RelatedJobsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 6;
}
