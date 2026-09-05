import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class SignupDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(12)
  @MaxLength(512)
  password!: string;
}

export class LoginDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  password!: string;
}

export class TokenDto {
  @ApiProperty()
  @IsString()
  @MinLength(16)
  @MaxLength(512)
  token!: string;
}

export class EmailDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(320)
  email!: string;
}

export class ResetPasswordDto extends TokenDto {
  @ApiProperty()
  @IsString()
  @MinLength(12)
  @MaxLength(512)
  password!: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  currentPassword!: string;

  @ApiProperty()
  @IsString()
  @MinLength(12)
  @MaxLength(512)
  newPassword!: string;
}

export class UpdateUserStatusDto {
  @ApiProperty({ enum: ["PENDING_VERIFICATION", "ACTIVE", "LOCKED", "DISABLED"] })
  @IsString()
  status!: "PENDING_VERIFICATION" | "ACTIVE" | "LOCKED" | "DISABLED";
}

export class UpdateUserRoleDto {
  @ApiProperty({ enum: ["USER", "ADMIN"] })
  @IsString()
  role!: "USER" | "ADMIN";
}

export class RevokeSessionDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
