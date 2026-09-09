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

export class CreateAlertDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 100, { message: 'Alert name must be between 1 and 100 characters' })
  name!: string;

  @IsEnum(AlertChannel)
  channel: AlertChannel = AlertChannel.BOTH;

  @IsEnum(AlertCadence)
  cadence: AlertCadence = AlertCadence.DAILY;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  deliveryHourUtc: number = 9;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  deliveryDayOfWeek?: number;

  @ValidateNested()
  @Type(() => AlertCriteriaDto)
  criteria!: AlertCriteriaDto;
}
