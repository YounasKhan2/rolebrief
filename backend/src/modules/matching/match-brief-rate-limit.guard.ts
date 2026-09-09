import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request, Response } from "express";
import { AUTH_USER_KEY } from "../../auth/auth.constants";
import type { AuthenticatedUser } from "../../auth/auth.decorators";
import { RateLimitService } from "../../common/rate-limit/rate-limit.service";

function userFromRequest(req: Request): AuthenticatedUser | undefined {
  return ((req as any)[AUTH_USER_KEY] || (req as any).user) as AuthenticatedUser | undefined;
}

@Injectable()
export class MatchBriefBatchRateLimitGuard implements CanActivate {
  constructor(private readonly rateLimit: RateLimitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const user = userFromRequest(req);
    if (!user?.id) throw new UnauthorizedException("Authentication required.");
    try {
      await this.rateLimit.consume({ namespace: "match-brief:batch", subject: user.id, limit: 60, windowSeconds: 60 });
      return true;
    } catch (err: any) {
      setRetryAfter(err, res);
      throw err;
    }
  }
}

@Injectable()
export class MatchBriefDetailRateLimitGuard implements CanActivate {
  constructor(private readonly rateLimit: RateLimitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const user = userFromRequest(req);
    if (!user?.id) throw new UnauthorizedException("Authentication required.");
    try {
      await this.rateLimit.consume({ namespace: "match-brief:detail", subject: user.id, limit: 120, windowSeconds: 60 });
      return true;
    } catch (err: any) {
      setRetryAfter(err, res);
      throw err;
    }
  }
}

function setRetryAfter(err: unknown, res: Response) {
  if (err instanceof HttpException && err.getStatus() === HttpStatus.TOO_MANY_REQUESTS) {
    const responseObj = err.getResponse() as any;
    const retryAfter = responseObj?.retryAfterSeconds || 60;
    res.setHeader("Retry-After", String(retryAfter));
  }
}

