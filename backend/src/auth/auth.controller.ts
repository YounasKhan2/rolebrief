import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { ChangePasswordDto, EmailDto, LoginDto, ResetPasswordDto, SignupDto, TokenDto } from "./dto/auth.dto";
import { CurrentUser, Public, AuthenticatedUser } from "./auth.decorators";
import { CsrfGuard } from "./csrf.guard";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Get("csrf")
  @ApiOperation({ summary: "Issue a readable CSRF cookie for authenticated state-changing requests" })
  csrf(@Res({ passthrough: true }) res: Response) {
    return { csrf: this.auth.setCsrfCookie(res) };
  }

  @Public()
  @Post("signup")
  @ApiOperation({ summary: "Create a pending USER account and queue a verification email" })
  @ApiResponse({ status: 201, description: "Account created. Verification email delivery is queued asynchronously." })
  signup(@Body() body: SignupDto, @Req() req: Request) {
    return this.auth.signup(body.name, body.email, body.password, req);
  }

  @Public()
  @Post("login")
  @ApiOperation({ summary: "Log in with email and password" })
  @ApiResponse({ status: 201, description: "Sets secure HttpOnly auth cookies and returns the current user." })
  login(@Body() body: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.login(body.email, body.password, req, res);
  }

  @Post("logout")
  @Public()
  @UseGuards(CsrfGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Log out the current session" })
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.logout(req, res);
  }

  @Public()
  @Post("refresh")
  @ApiOperation({ summary: "Rotate refresh credentials and issue a new access session cookie" })
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.refresh(req, res);
  }

  @Get("me")
  @ApiOperation({ summary: "Return the trusted current user from backend session state" })
  me(@CurrentUser() user: AuthenticatedUser) {
    return { user: this.auth.me(user) };
  }

  @Public()
  @Post("verify-email")
  @ApiOperation({ summary: "Consume a single-use email verification token" })
  @ApiResponse({ status: 201, description: "Email verified. The user can now log in." })
  @ApiResponse({ status: 400, description: "Verification link is invalid, expired, or already used." })
  verifyEmail(@Body() body: TokenDto, @Req() req: Request) {
    return this.auth.verifyEmail(body.token, req);
  }

  @Public()
  @Post("resend-verification")
  @ApiOperation({ summary: "Queue another verification email when the account is still unverified" })
  @ApiResponse({ status: 201, description: "Always returns a generic recovery response to prevent account enumeration." })
  resendVerification(@Body() body: EmailDto, @Req() req: Request) {
    return this.auth.resendVerification(body.email, req);
  }

  @Public()
  @Post("forgot-password")
  @ApiOperation({ summary: "Queue a password reset email when recovery is available" })
  @ApiResponse({ status: 201, description: "Always returns a generic recovery response to prevent account enumeration." })
  forgotPassword(@Body() body: EmailDto, @Req() req: Request) {
    return this.auth.forgotPassword(body.email, req);
  }

  @Public()
  @Post("reset-password")
  @ApiOperation({ summary: "Consume a single-use password reset token and revoke active sessions" })
  @ApiResponse({ status: 201, description: "Password changed. Existing sessions are revoked and a security notice is queued." })
  @ApiResponse({ status: 400, description: "Reset link is invalid, expired, or already used." })
  resetPassword(@Body() body: ResetPasswordDto, @Req() req: Request) {
    return this.auth.resetPassword(body.token, body.password, req);
  }

  @Post("change-password")
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: "Change password for the authenticated user and revoke other sessions" })
  changePassword(@CurrentUser() user: AuthenticatedUser, @Body() body: ChangePasswordDto) {
    return this.auth.changePassword(user, body.currentPassword, body.newPassword);
  }

  @Get("sessions")
  @ApiOperation({ summary: "List active sessions for the authenticated user" })
  sessions(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.listSessions(user);
  }

  @Delete("sessions/:sessionId")
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: "Revoke one active session for the authenticated user" })
  revokeSession(@CurrentUser() user: AuthenticatedUser, @Param("sessionId") sessionId: string) {
    return this.auth.revokeSession(user, sessionId);
  }

  @Post("logout-all")
  @UseGuards(CsrfGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Revoke all sessions for the authenticated user" })
  logoutAll(@CurrentUser() user: AuthenticatedUser, @Res({ passthrough: true }) res: Response) {
    return this.auth.logoutAll(user, res);
  }
}
