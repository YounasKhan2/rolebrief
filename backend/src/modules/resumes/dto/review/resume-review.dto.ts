import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export enum ResumeReviewActionDto {
  ACCEPT = "ACCEPT",
  EDIT_AND_ACCEPT = "EDIT_AND_ACCEPT",
  REJECT = "REJECT",
  CATEGORIZE = "CATEGORIZE"
}

export enum ResumeReviewCategoryDto {
  IDENTITY = "IDENTITY",
  CONTACT = "CONTACT",
  SUMMARY = "SUMMARY",
  EMPLOYMENT = "EMPLOYMENT",
  EDUCATION = "EDUCATION",
  SKILL = "SKILL",
  PROJECT = "PROJECT",
  CERTIFICATION = "CERTIFICATION",
  LICENCE = "LICENCE",
  LANGUAGE = "LANGUAGE",
  AWARD = "AWARD",
  PUBLICATION = "PUBLICATION",
  VOLUNTEERING = "VOLUNTEERING",
  MEMBERSHIP = "MEMBERSHIP",
  RESEARCH = "RESEARCH",
  PATENT = "PATENT",
  PORTFOLIO_LINK = "PORTFOLIO_LINK",
  REFERENCE = "REFERENCE",
  ADDITIONAL_INFORMATION = "ADDITIONAL_INFORMATION",
  CUSTOM_SECTION = "CUSTOM_SECTION",
  SENSITIVE_EXCLUDED = "SENSITIVE_EXCLUDED",
  UNSUPPORTED = "UNSUPPORTED"
}

export class ResumeReviewOperationDto {
  @ApiProperty({ example: "rdi_0123456789abcdef01234567" })
  @IsString()
  @Matches(/^rdi_[a-f0-9]{24}$/)
  itemId!: string;

  @ApiProperty({ enum: ResumeReviewActionDto })
  @IsEnum(ResumeReviewActionDto)
  action!: ResumeReviewActionDto;

  @ApiPropertyOptional({ description: "Category-specific bounded value for EDIT_AND_ACCEPT." })
  @IsOptional()
  @IsObject()
  editedValue?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: ResumeReviewCategoryDto })
  @IsOptional()
  @IsEnum(ResumeReviewCategoryDto)
  targetCategory?: ResumeReviewCategoryDto;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional({ maxLength: 80, description: "Bounded display label for custom sections; not an internal enum." })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  customLabel?: string;
}

export class UpdateResumeDraftReviewDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  draftId!: string;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  expectedReviewRevision!: number;

  @ApiProperty({ description: "Caller-stable idempotency key for this review mutation." })
  @IsString()
  @MaxLength(120)
  @Matches(/^[a-zA-Z0-9._:-]{8,120}$/)
  idempotencyKey!: string;

  @ApiProperty({ type: [ResumeReviewOperationDto], minItems: 1, maxItems: 100 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ResumeReviewOperationDto)
  operations!: ResumeReviewOperationDto[];
}
