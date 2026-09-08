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
import { AUTH_USER_KEY } from "../../auth/auth.constants";
import type { AuthenticatedUser } from "../../auth/auth.decorators";

@Injectable()
export class ProfileRateLimitGuard implements CanActivate {
  constructor(private readonly rateLimit: RateLimitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const user = ((req as any)[AUTH_USER_KEY] || (req as any).user) as AuthenticatedUser | undefined;
    if (!user || !user.id) {
      throw new UnauthorizedException("Authentication required.");
    }

    try {
      await this.rateLimit.consume({
        namespace: "profile:mutation",
        subject: user.id,
        limit: 30,
        windowSeconds: 60
      });
      return true;
    } catch (err: any) {
      if (err instanceof HttpException && err.getStatus() === HttpStatus.TOO_MANY_REQUESTS) {
        const responseObj = err.getResponse() as any;
        const retryAfter = responseObj?.retryAfterSeconds || 60;
        if (res && typeof res.setHeader === "function") {
          res.setHeader("Retry-After", String(retryAfter));
        }
      }
      throw err;
    }
  }
}
