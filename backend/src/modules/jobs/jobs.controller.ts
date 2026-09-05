import { Controller, Get, NotFoundException, Param, Query } from "@nestjs/common";
import { Public } from "../../auth/auth.decorators";
import { JobsService } from "./jobs.service";

@Controller("jobs")
@Public()
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  list(@Query("cursor") cursor?: string, @Query("limit") limit?: string) {
    return this.jobs.list(cursor, limit ? Number(limit) : 20);
  }

  @Get(":slug")
  async getBySlug(@Param("slug") slug: string) {
    const job = await this.jobs.getBySlug(slug);
    if (!job) {
      throw new NotFoundException("Job not found");
    }
    return job;
  }
}
