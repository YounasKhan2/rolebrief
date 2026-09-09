import { Controller, Get, Query, UseGuards, ValidationPipe } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser, AuthenticatedUser } from "../../auth/auth.decorators";
import { UserRoleGuard } from "../../auth/user-role.guard";
import { RadarFeedQueryDto } from "./dto/radar-feed-query.dto";
import { RadarRateLimitGuard } from "./radar-rate-limit.guard";
import { RadarService } from "./radar.service";

@ApiTags("Radar")
@ApiBearerAuth()
@Controller("radar")
@UseGuards(UserRoleGuard)
export class RadarController {
  constructor(private readonly radar: RadarService) {}

  @Get("feed")
  @UseGuards(RadarRateLimitGuard)
  @ApiOperation({ summary: "Return a deterministic user Radar snapshot page" })
  feed(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
    query: RadarFeedQueryDto
  ) {
    return this.radar.feed(user.id, query);
  }

  @Get("summary")
  @UseGuards(RadarRateLimitGuard)
  @ApiOperation({ summary: "Return user Radar summary counts" })
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.radar.summary(user.id);
  }
}
