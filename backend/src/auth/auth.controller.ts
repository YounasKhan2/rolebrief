import { Body, Controller, Delete, Get, Param, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
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
  csrf(@Res({ passthrough: true }) res: Response) {
    return this.auth.setCsrfCookie(res);
  }

  @Public()
  @Post("signup")
  signup(@Body() body: SignupDto, @Req() req: Request) {
    return this.auth.signup(body.name, body.email, body.password, req);
  }

  @Public()
  @Post("login")
  login(@Body() body: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.login(body.email, body.password, req, res);
  }

  @Post("logout")
  @UseGuards(CsrfGuard)
  logout(@CurrentUser() user: AuthenticatedUser, @Res({ passthrough: true }) res: Response) {
    return this.auth.logout(user, res);
  }

  @Public()
  @Post("refresh")
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.refresh(req, res);
  }

  @Get("me")
  me(@CurrentUser() user: AuthenticatedUser) {
    return { user: this.auth.me(user) };
  }

  @Public()
  @Post("verify-email")
  verifyEmail(@Body() body: TokenDto) {
    return this.auth.verifyEmail(body.token);
  }

  @Public()
  @Post("resend-verification")
  resendVerification(@Body() body: EmailDto, @Req() req: Request) {
    return this.auth.resendVerification(body.email, req);
  }

  @Public()
  @Post("forgot-password")
  forgotPassword(@Body() body: EmailDto, @Req() req: Request) {
    return this.auth.forgotPassword(body.email, req);
  }

  @Public()
  @Post("reset-password")
  resetPassword(@Body() body: ResetPasswordDto) {
    return this.auth.resetPassword(body.token, body.password);
  }

  @Post("change-password")
  @UseGuards(CsrfGuard)
  changePassword(@CurrentUser() user: AuthenticatedUser, @Body() body: ChangePasswordDto) {
    return this.auth.changePassword(user, body.currentPassword, body.newPassword);
  }

  @Get("sessions")
  sessions(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.listSessions(user);
  }

  @Delete("sessions/:sessionId")
  @UseGuards(CsrfGuard)
  revokeSession(@CurrentUser() user: AuthenticatedUser, @Param("sessionId") sessionId: string) {
    return this.auth.revokeSession(user, sessionId);
  }

  @Post("logout-all")
  @UseGuards(CsrfGuard)
  logoutAll(@CurrentUser() user: AuthenticatedUser, @Res({ passthrough: true }) res: Response) {
    return this.auth.logoutAll(user, res);
  }
}
