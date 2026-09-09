import { AlertEligibilityPolicy, WorkMode } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches
} from 'class-validator';
import { AlertAlignmentTier, AlertCriteriaV1 } from '../alerts.types';

export class AlertCriteriaDto implements AlertCriteriaV1 {
  @IsInt()
  @IsIn([1])
  version: 1 = 1;

  @IsArray()
  @ArrayMaxSize(5, { message: 'Maximum 5 target titles allowed per alert' })
  @IsString({ each: true })
  @Length(1, 80, { each: true })
  targetTitles: string[] = [];

  @IsArray()
  @IsEnum(WorkMode, { each: true })
  workModes: WorkMode[] = [];

  @IsArray()
  @IsString({ each: true })
  employmentTypes: string[] = [];

  @IsArray()
  @IsString({ each: true })
  @Matches(/^[A-Z]{2}$/, { each: true, message: 'Country codes must be ISO-3166-1 alpha-2 uppercase' })
  countryCodes: string[] = [];

  @IsArray()
  @IsString({ each: true })
  providers: string[] = [];

  @IsOptional()
  @IsBoolean()
  salaryDisclosed?: boolean;

  @IsEnum(AlertEligibilityPolicy)
  eligibilityPolicy: AlertEligibilityPolicy = AlertEligibilityPolicy.NO_KNOWN_CONFLICTS;

  @IsIn(['STRONG_ALIGNMENT', 'PARTIAL_ALIGNMENT', 'ANY'])
  alignment: AlertAlignmentTier = 'ANY';
}
