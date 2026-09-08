import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  Min,
  ValidateNested
} from "class-validator";
import {
  CandidateSkillInputDto,
  OnboardingStepEnum,
  UpdatePreferencesDto,
  UpdateProfileDto
} from "../../profile/dto/profile.dto";

export class AutosaveOnboardingDto {
  @ApiProperty({ description: "Optimistic concurrency revision number. Initial state is 0." })
  @IsInt()
  @Min(0)
  expectedRevision!: number;

  @ApiPropertyOptional({ description: "Optimistic concurrency revision number for candidate profile data" })
  @IsOptional()
  @IsInt()
  @Min(0)
  expectedCandidateRevision?: number;

  @ApiPropertyOptional({ enum: OnboardingStepEnum, description: "Identifier of the active wizard step" })
  @IsOptional()
  @IsEnum(OnboardingStepEnum)
  currentStep?: OnboardingStepEnum;

  @ApiPropertyOptional({ enum: OnboardingStepEnum, isArray: true, description: "List of completed wizard steps" })
  @IsOptional()
  @IsArray()
  @IsEnum(OnboardingStepEnum, { each: true })
  completedSteps?: OnboardingStepEnum[];

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

export class SkipOnboardingDto {
  @ApiProperty({ description: "Optimistic concurrency revision number" })
  @IsInt()
  @Min(0)
  expectedRevision!: number;
}

export class CompleteOnboardingDto {
  @ApiProperty({ description: "Optimistic concurrency revision number" })
  @IsInt()
  @Min(0)
  expectedRevision!: number;
}

