import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested
} from "class-validator";
import {
  CandidateSkillInputDto,
  UpdatePreferencesDto,
  UpdateProfileDto
} from "../../profile/dto/profile.dto";

export class AutosaveOnboardingDto {
  @ApiProperty({ description: "Optimistic concurrency revision number. Initial state is 0." })
  @IsInt()
  @Min(0)
  expectedRevision!: number;

  @ApiPropertyOptional({ description: "Identifier of the active wizard step" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  currentStep?: string;

  @ApiPropertyOptional({ type: [String], description: "List of completed wizard steps" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  completedSteps?: string[];

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
