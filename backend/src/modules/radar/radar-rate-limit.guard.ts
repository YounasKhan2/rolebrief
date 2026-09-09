import { CanActivate, ExecutionContext, HttpException, Injectable } from "@nestjs/common";
import { RateLimitService } from "../../common/rate-limit/rate-limit.service";

@Injectable()
export class RadarRateLimitGuard implements CanActivate {
  constructor(private readonly rateLimit: RateLimitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const userId = req.user?.id ?? req.ip ?? "anonymous";
    try {
      await this.rateLimit.consume({
        namespace: "radar-feed",
        subject: userId,
        limit: 60,
        windowSeconds: 60
      });
      return true;
    } catch (err: any) {
      if (err instanceof HttpException) {
        const body = err.getResponse() as any;
        if (body?.retryAfterSeconds) {
          res.setHeader("Retry-After", String(body.retryAfterSeconds));
        }
      }
      throw err;
    }
  }
}
