import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from "class-validator";

export enum RemotePreferenceEnum {
  REMOTE_ONLY = "REMOTE_ONLY",
  HYBRID = "HYBRID",
  ONSITE = "ONSITE",
  OPEN_TO_ANY = "OPEN_TO_ANY"
}

export enum SeniorityLevelEnum {
  ENTRY = "ENTRY",
  MID = "MID",
  SENIOR = "SENIOR",
  LEAD = "LEAD",
  PRINCIPAL = "PRINCIPAL",
  DIRECTOR = "DIRECTOR",
  EXECUTIVE = "EXECUTIVE"
}

export enum OnboardingStepEnum {
  GOAL = "GOAL",
  REACH = "REACH",
  FIT = "FIT",
  REVIEW = "REVIEW"
}

export enum SalaryPeriodEnum {
  HOURLY = "HOURLY",
  MONTHLY = "MONTHLY",
  ANNUAL = "ANNUAL"
}

export enum EmploymentTypeEnum {
  FULL_TIME = "FULL_TIME",
  PART_TIME = "PART_TIME",
  CONTRACT = "CONTRACT",
  INTERNSHIP = "INTERNSHIP",
  TEMPORARY = "TEMPORARY"
}

export enum CandidateSearchStatusEnum {
  ACTIVELY_LOOKING = "ACTIVELY_LOOKING",
  OPEN_TO_OFFERS = "OPEN_TO_OFFERS",
  CASUAL = "CASUAL",
  NOT_LOOKING = "NOT_LOOKING"
}

export enum RelocationPreferenceEnum {
  NOT_OPEN = "NOT_OPEN",
  WILLING_TO_RELOCATE = "WILLING_TO_RELOCATE",
  OPEN_TO_REMOTE_ONLY = "OPEN_TO_REMOTE_ONLY"
}

export class CandidateSkillInputDto {
  @ApiProperty()
  @IsString()
  @MaxLength(80)
  displayName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(70)
  yearsExperience?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isTopSkill?: boolean;
}

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(140)
  headline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(70)
  experienceYears?: number;

  @ApiPropertyOptional({ enum: SeniorityLevelEnum })
  @IsOptional()
  @IsEnum(SeniorityLevelEnum)
  seniorityLevel?: SeniorityLevelEnum;

  @ApiPropertyOptional({ description: "ISO 3166-1 alpha-2 country code" })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  currentCountry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  currentCity?: string;

  @ApiPropertyOptional({ type: [String], description: "List of ISO 3166-1 alpha-2 country codes" })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(2, { each: true })
  workAuthorizations?: string[];

  @ApiPropertyOptional({ description: "Account canonical timezone" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;

  @ApiPropertyOptional({ description: "Whether candidate requires employer visa sponsorship (null = not declared)" })
  @IsOptional()
  @IsBoolean()
  requiresVisaSponsorship?: boolean;

  @ApiPropertyOptional({ enum: CandidateSearchStatusEnum })
  @IsOptional()
  @IsEnum(CandidateSearchStatusEnum)
  searchStatus?: CandidateSearchStatusEnum;
}

export class UpdatePreferencesDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  targetRoleTitles?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  targetDisciplines?: string[];

  @ApiPropertyOptional({ enum: RemotePreferenceEnum })
  @IsOptional()
  @IsEnum(RemotePreferenceEnum)
  remotePreference?: RemotePreferenceEnum;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(2, { each: true })
  preferredCountries?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  preferredCities?: string[];

  @ApiPropertyOptional({ enum: EmploymentTypeEnum, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsEnum(EmploymentTypeEnum, { each: true })
  employmentTypes?: EmploymentTypeEnum[];

  @ApiPropertyOptional({ enum: RelocationPreferenceEnum })
  @IsOptional()
  @IsEnum(RelocationPreferenceEnum)
  relocationPreference?: RelocationPreferenceEnum;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  minSalary?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  maxSalary?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  salaryCurrency?: string;

  @ApiPropertyOptional({ enum: SalaryPeriodEnum })
  @IsOptional()
  @IsEnum(SalaryPeriodEnum)
  salaryPeriod?: SalaryPeriodEnum;
}

export class UpdateCandidateProfilePayloadDto {
  @ApiProperty({ description: "Optimistic concurrency revision for candidate data" })
  @IsInt()
  @Min(0)
  expectedRevision!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateProfileDto)
  profile?: UpdateProfileDto;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdatePreferencesDto)
  preferences?: UpdatePreferencesDto;

  @ApiPropertyOptional({ type: [CandidateSkillInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CandidateSkillInputDto)
  skills?: CandidateSkillInputDto[];
}
