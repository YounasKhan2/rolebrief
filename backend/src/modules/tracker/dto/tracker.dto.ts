import { Type } from "class-transformer";
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min
} from "class-validator";
import { ApplicationLifecycle, ApplicationStage } from "@prisma/client";

export { ApplicationLifecycle, ApplicationStage };

export class CreateApplicationDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]{1,120}$/, { message: "Invalid job slug format" })
  jobSlug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  roleTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  companyName?: string;

  @IsOptional()
  @IsEnum(ApplicationStage)
  stage?: ApplicationStage = ApplicationStage.SAVED;

  @IsOptional()
  @IsISO8601()
  appliedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  nextAction?: string;

  @IsOptional()
  @IsISO8601()
  nextActionAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsOptional()
  @IsISO8601()
  reminderAt?: string;

  @IsOptional()
  @IsISO8601()
  interviewAt?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ["http", "https"] })
  @MaxLength(2048)
  sourceUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourceLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contactName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  contactEmail?: string;
}

export class UpdateApplicationDto {
  @IsInt()
  @Min(0)
  expectedRevision!: number;

  @IsOptional()
  @IsEnum(ApplicationStage)
  stage?: ApplicationStage;

  @IsOptional()
  @IsEnum(ApplicationLifecycle)
  lifecycle?: ApplicationLifecycle;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  roleTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  companyName?: string;

  @IsOptional()
  @IsISO8601()
  appliedAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  nextAction?: string | null;

  @IsOptional()
  @IsISO8601()
  nextActionAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;

  @IsOptional()
  @IsISO8601()
  reminderAt?: string | null;

  @IsOptional()
  @IsISO8601()
  interviewAt?: string | null;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ["http", "https"] })
  @MaxLength(2048)
  sourceUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourceLabel?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contactName?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  contactEmail?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  stageChangeNote?: string;
}

export class TrackerQueryDto {
  @IsOptional()
  @IsEnum(ApplicationStage)
  stage?: ApplicationStage;

  @IsOptional()
  @IsEnum(ApplicationLifecycle)
  lifecycle?: ApplicationLifecycle = ApplicationLifecycle.ACTIVE;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;
}

export class DeleteApplicationDto {
  @IsInt()
  @Min(0)
  expectedRevision!: number;
}
