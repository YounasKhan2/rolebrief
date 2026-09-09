import { ApiProperty } from "@nestjs/swagger";
import { ArrayMaxSize, ArrayNotEmpty, ArrayUnique, IsArray, IsString, Matches } from "class-validator";

export const JOB_SLUG_REGEX = /^[a-zA-Z0-9_-]{1,120}$/;

export class BatchEligibilityQueryDto {
  @ApiProperty({
    description: "Array of unique job slugs to evaluate (max 50)",
    example: ["acme-corp-1234567890ab", "nextiva-2aa01b699a68"]
  })
  @IsArray()
  @ArrayNotEmpty({ message: "Slugs array must not be empty" })
  @ArrayMaxSize(50, { message: "Cannot query more than 50 job slugs in a single batch" })
  @ArrayUnique({ message: "Slugs in batch must be unique" })
  @IsString({ each: true })
  @Matches(JOB_SLUG_REGEX, {
    each: true,
    message: "Each job slug must be 1-120 alphanumeric characters, hyphens, or underscores"
  })
  slugs!: string[];
}
