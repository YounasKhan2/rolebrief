import { Transform } from "class-transformer";
import { IsArray, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import {
  RADAR_DEFAULT_PAGE_SIZE,
  RADAR_MAX_PAGE_SIZE,
  RadarEligibilityFilter,
  RadarSort,
  RadarTrackedFilter
} from "../radar.types";

function splitCsv(value: unknown): string[] | undefined {
  if (value == null || value === "") return undefined;
  if (Array.isArray(value)) return value.flatMap((v) => splitCsv(v) ?? []);
  return String(value)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export class RadarFeedQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value ?? RADAR_DEFAULT_PAGE_SIZE))
  @IsInt()
  @Min(1)
  @Max(RADAR_MAX_PAGE_SIZE)
  limit: number = RADAR_DEFAULT_PAGE_SIZE;

  @IsOptional()
  @IsIn(["relevance", "freshest"])
  sort: RadarSort = "relevance";

  @IsOptional()
  @IsIn(["NO_KNOWN_CONFLICTS", "INCLUDE_ALL"])
  eligibility?: RadarEligibilityFilter;

  @IsOptional()
  @Transform(({ value }) => splitCsv(value))
  @IsArray()
  @IsIn(["STRONG_ALIGNMENT", "PARTIAL_ALIGNMENT", "LIMITED_ALIGNMENT", "NOT_CALCULATED"], { each: true })
  alignment?: string[];

  @IsOptional()
  @IsIn(["include", "exclude", "only"])
  tracked?: RadarTrackedFilter = "include";

  @IsOptional()
  @Transform(({ value }) => splitCsv(value))
  @IsArray()
  @IsString({ each: true })
  workMode?: string[];

  @IsOptional()
  @Transform(({ value }) => splitCsv(value))
  @IsArray()
  @IsString({ each: true })
  employmentType?: string[];

  @IsOptional()
  @Transform(({ value }) => splitCsv(value))
  @IsArray()
  @IsString({ each: true })
  country?: string[];

  @IsOptional()
  @Transform(({ value }) => splitCsv(value))
  @IsArray()
  @IsString({ each: true })
  provider?: string[];

  @IsOptional()
  @IsIn(["true", "false", true, false])
  salaryDisclosed?: string | boolean;

  @IsOptional()
  @IsIn(["seven_days"])
  freshnessWindow?: "seven_days";
}
