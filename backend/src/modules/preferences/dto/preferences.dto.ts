import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min
} from "class-validator";

export enum MotionPreferenceEnum {
  SYSTEM = "SYSTEM",
  REDUCE = "REDUCE",
  NO_PREFERENCE = "NO_PREFERENCE"
}

export enum ContrastPreferenceEnum {
  SYSTEM = "SYSTEM",
  HIGH = "HIGH",
  NORMAL = "NORMAL"
}

export class UpdatePreferencesDto {
  @ApiPropertyOptional({ description: "Receive product update emails" })
  @IsOptional()
  @IsBoolean()
  productUpdates?: boolean;

  @ApiPropertyOptional({ description: "Receive marketing and promotional emails" })
  @IsOptional()
  @IsBoolean()
  marketingEmails?: boolean;

  @ApiPropertyOptional({
    enum: MotionPreferenceEnum,
    description: "Motion preference (SYSTEM, REDUCE, NO_PREFERENCE)"
  })
  @IsOptional()
  @IsEnum(MotionPreferenceEnum)
  motionPreference?: MotionPreferenceEnum;

  @ApiPropertyOptional({
    enum: ContrastPreferenceEnum,
    description: "Contrast preference (SYSTEM, HIGH, NORMAL)"
  })
  @IsOptional()
  @IsEnum(ContrastPreferenceEnum)
  contrastPreference?: ContrastPreferenceEnum;

  @ApiPropertyOptional({ description: "User IANA timezone identifier", example: "America/New_York" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;

  @ApiProperty({
    description: "Expected current revision for optimistic concurrency control (0 for initial virtual state)",
    example: 0
  })
  @IsNotEmpty({ message: "expectedRevision is required for optimistic concurrency control." })
  @IsInt()
  @Min(0)
  expectedRevision!: number;
}
