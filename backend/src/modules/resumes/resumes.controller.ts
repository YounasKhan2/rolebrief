import { Body, Controller, Param, Post, Req, Res, UseGuards } from "@nestjs/common";
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

  @Post("upload-session")
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: "Create a short-lived direct upload session for a PDF or DOCX resume" })
  @ApiResponse({ status: 201, description: "Upload session created or idempotently replayed" })
  @ApiResponse({ status: 403, description: "Forbidden for administrative accounts" })
  @ApiResponse({ status: 413, description: "Resume exceeds the 10 MB limit" })
  @ApiResponse({ status: 415, description: "Unsupported resume file type" })
  @ApiResponse({ status: 503, description: "Upload admission control or storage unavailable" })
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
  @ApiOperation({ summary: "Confirm that the direct-uploaded resume object exists and matches declared metadata" })
  @ApiResponse({ status: 201, description: "Upload confirmed and ready for later verification/scanning boundary" })
  @ApiResponse({ status: 400, description: "Object size, type, or checksum mismatch" })
  @ApiResponse({ status: 403, description: "Forbidden for administrative accounts" })
  @ApiResponse({ status: 404, description: "Resume document or object not found" })
  @ApiResponse({ status: 503, description: "Upload admission control or storage unavailable" })
  confirmUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: ConfirmResumeUploadDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    return withRetryAfterHeader(res, () => this.uploads.confirmUpload(user.id, id, body, req.ip ?? ""));
  }
}
