import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import type { Request, Response } from "express";
import { RateLimitService } from "../../common/rate-limit/rate-limit.service";
import { AppConfigService } from "../../common/config/app-config.service";
import { AUTH_USER_KEY } from "../../auth/auth.constants";
import type { AuthenticatedUser } from "../../auth/auth.decorators";

@Injectable()
export class TrackerRateLimitGuard implements CanActivate {
  constructor(
    private readonly rateLimit: RateLimitService,
    private readonly config: AppConfigService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const user = ((req as any)[AUTH_USER_KEY] || (req as any).user) as AuthenticatedUser | undefined;
    if (!user || !user.id) {
      throw new UnauthorizedException("Authentication required.");
    }

    const limits = this.config.auth.trackerRateLimits;
    let namespace = "tracker:mutation";
    let limit = limits.mutate;
    let windowSeconds = 60;

    if (req.method === "DELETE") {
      namespace = "tracker:deletion";
      limit = limits.delete;
      windowSeconds = 3600; // 5/hour
    } else if (req.method === "GET" || req.method === "HEAD") {
      namespace = "tracker:read";
      limit = limits.read;
      windowSeconds = 60; // 120/minute
    }

    try {
      await this.rateLimit.consume({
        namespace,
        subject: user.id,
        limit,
        windowSeconds
      });
      return true;
    } catch (err: any) {
      if (err instanceof HttpException && err.getStatus() === HttpStatus.TOO_MANY_REQUESTS) {
        const responseObj = err.getResponse() as any;
        const retryAfter = responseObj?.retryAfterSeconds || windowSeconds;
        if (res && typeof res.setHeader === "function") {
          res.setHeader("Retry-After", String(retryAfter));
        }
      }
      throw err;
    }
  }
}
