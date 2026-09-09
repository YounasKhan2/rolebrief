import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from "class-validator";
import { Type } from "class-transformer";

export enum AdminModerationActionType {
  APPROVE = "APPROVE",
  EXPIRE = "EXPIRE",
  DISMISS = "DISMISS",
  REMOVE = "REMOVE"
}

export class AdminModerationActionDto {
  @IsEnum(AdminModerationActionType)
  action!: AdminModerationActionType;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AdminModerationQueueQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsString()
  tab?: "reports" | "suspicious" | "stale" | "expired" | "all";
}
