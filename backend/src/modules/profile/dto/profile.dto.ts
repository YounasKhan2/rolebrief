import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
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

export class CandidateSkillInputDto {
  @ApiPropertyOptional()
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  primaryDiscipline?: string;

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
  @IsString({ each: true })
  @MaxLength(2, { each: true })
  workAuthorizations?: string[];
}

export class UpdatePreferencesDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  targetRoleTitles?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
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
  @IsString({ each: true })
  @MaxLength(2, { each: true })
  preferredCountries?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  preferredCities?: string[];

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
  @MaxLength(3)
  salaryCurrency?: string;
}

export class UpdateCandidateProfilePayloadDto {
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
  @ValidateNested({ each: true })
  @Type(() => CandidateSkillInputDto)
  skills?: CandidateSkillInputDto[];
}
