import { Body, Controller, Get, Param, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { AuthenticatedUser, CurrentUser } from "../../auth/auth.decorators";
import { CsrfGuard } from "../../auth/csrf.guard";
import { UserRoleGuard } from "../../auth/user-role.guard";
import { ConfirmResumeUploadDto, CreateResumeUploadSessionDto } from "./dto/resume-upload.dto";
import { ResumeUploadService } from "./resume-upload.service";

async function withRetryAfterHeader<T>(res: Response, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (err: any) {
    const response = typeof err?.getResponse === "function" ? err.getResponse() : null;
    const retryAfter = typeof response === "object" && response ? (response as any).retryAfterSeconds : null;
    if (retryAfter) {
      res.setHeader("Retry-After", String(retryAfter));
    }
    throw err;
  }
}

@ApiTags("resumes")
@ApiBearerAuth()
@UseGuards(UserRoleGuard)
@Controller("me/resumes")
export class ResumesController {
  constructor(private readonly uploads: ResumeUploadService) {}

  @Get(":id")
  @ApiOperation({ summary: "Read safe resume validation and malware-scanning status for the current user" })
  @ApiResponse({ status: 200, description: "Safe processing status without object keys, hashes, scanner output, or queue identifiers" })
  @ApiResponse({ status: 404, description: "Resume document not found for the current user" })
  getStatus(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.uploads.getStatus(user.id, id);
  }

  @Post("upload-session")
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: "Create a short-lived direct upload session for a PDF or DOCX resume" })
  @ApiResponse({ status: 201, description: "Upload session created or idempotently replayed" })
  @ApiResponse({ status: 403, description: "Forbidden for administrative accounts" })
  @ApiResponse({ status: 413, description: "Resume exceeds the 10 MB limit" })
  @ApiResponse({ status: 415, description: "Unsupported resume file type" })
  @ApiResponse({ status: 429, description: "Upload admission rate limit exceeded" })
  @ApiResponse({ status: 503, description: "Upload admission control or storage unavailable; Retry-After may be returned" })
  createUploadSession(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateResumeUploadSessionDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    return withRetryAfterHeader(res, () => this.uploads.createUploadSession(user.id, body, req.ip ?? ""));
  }

  @Post(":id/confirm-upload")
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: "Confirm a direct-uploaded resume and queue trusted validation plus private ClamAV scanning" })
  @ApiResponse({ status: 201, description: "Upload confirmed and verification/scanning queued while the file remains quarantined" })
  @ApiResponse({ status: 400, description: "Object size, type, or checksum mismatch" })
  @ApiResponse({ status: 403, description: "Forbidden for administrative accounts" })
  @ApiResponse({ status: 404, description: "Resume document or object not found" })
  @ApiResponse({ status: 409, description: "Upload confirmation conflicts with the original session metadata" })
  @ApiResponse({ status: 429, description: "Upload confirmation rate limit exceeded" })
  @ApiResponse({ status: 503, description: "Verification queue or storage unavailable; Retry-After may be returned" })
  confirmUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: ConfirmResumeUploadDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    return withRetryAfterHeader(res, () => this.uploads.confirmUpload(user.id, id, body, req.ip ?? ""));
  }

  @Post(":id/retry-verification")
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: "Retry verification for a retryable failed resume upload" })
  @ApiResponse({ status: 201, description: "Verification retry queued, or current terminal status returned when retry is not needed" })
  @ApiResponse({ status: 409, description: "Resume verification is already active" })
  @ApiResponse({ status: 429, description: "Retry rate limit exceeded" })
  @ApiResponse({ status: 503, description: "Verification queue unavailable; Retry-After may be returned" })
  retryVerification(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    return withRetryAfterHeader(res, () => this.uploads.retryVerification(user.id, id, req.ip ?? ""));
  }
}
