import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Request } from "express";
import { AppConfigService } from "../common/config/app-config.service";
import { CSRF_COOKIE, CSRF_HEADER } from "./auth.constants";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly config: AppConfigService) {}

  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method)) return true;
    const origin = req.get("origin");
    const referer = req.get("referer");
    const allowed = this.config.frontendOrigins;
    if (origin && !allowed.includes(origin)) {
      throw new ForbiddenException("Origin is not allowed.");
    }
    if (!origin && referer) {
      const refererOrigin = new URL(referer).origin;
      if (!allowed.includes(refererOrigin)) throw new ForbiddenException("Referer is not allowed.");
    }

    const header = req.get(CSRF_HEADER);
    const cookie = req.cookies?.[CSRF_COOKIE];
    if (!header || !cookie || header !== cookie) {
      throw new ForbiddenException("CSRF token required.");
    }
    return true;
  }
}
