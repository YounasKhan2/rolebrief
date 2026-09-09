import { AlertCadence, AlertChannel } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested
} from 'class-validator';
import { AlertCriteriaDto } from './alert-criteria.dto';

export class UpdateAlertDto {
  @IsInt()
  @Min(0)
  expectedRevision!: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @IsEnum(AlertChannel)
  channel?: AlertChannel;

  @IsOptional()
  @IsEnum(AlertCadence)
  cadence?: AlertCadence;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  deliveryHourUtc?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  deliveryDayOfWeek?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => AlertCriteriaDto)
  criteria?: AlertCriteriaDto;
}
