import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, Matches } from "class-validator";

export class BatchMatchBriefDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { each: true })
  slugs!: string[];
}

