import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsNotEmpty, IsString, Matches, Max, MaxLength, Min } from "class-validator";

export class CreateResumeUploadSessionDto {
  @ApiProperty({ example: "resume.pdf" })
  @IsString()
  @MaxLength(180)
  filename!: string;

  @ApiProperty({ enum: ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"] })
  @IsString()
  @IsNotEmpty()
  mimeType!: string;

  @ApiProperty({ maximum: 10485760 })
  @IsInt()
  @Min(1)
  @Max(10 * 1024 * 1024)
  byteSize!: number;

  @ApiProperty({ description: "Lowercase hex SHA-256 digest of the file bytes." })
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  sha256!: string;

  @ApiProperty({ description: "Caller-stable idempotency key for creating one upload session." })
  @IsString()
  @MaxLength(120)
  @Matches(/^[a-zA-Z0-9._:-]{8,120}$/)
  idempotencyKey!: string;
}

export class ConfirmResumeUploadDto {
  @ApiProperty({ description: "Lowercase hex SHA-256 digest originally declared for this object." })
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  sha256!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(10 * 1024 * 1024)
  byteSize!: number;

  @ApiProperty({ description: "Caller-stable idempotency key for upload confirmation." })
  @IsString()
  @MaxLength(120)
  @Matches(/^[a-zA-Z0-9._:-]{8,120}$/)
  idempotencyKey!: string;
}
