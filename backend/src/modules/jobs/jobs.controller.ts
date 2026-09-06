import { Controller, Get, NotFoundException, Param, Query, ValidationPipe } from "@nestjs/common";
import { Public } from "../../auth/auth.decorators";
import { JobFacetsQueryDto, JobsQueryDto, RelatedJobsQueryDto } from "./dto/jobs-query.dto";
import { JobsService } from "./jobs.service";

@Controller("jobs")
@Public()
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  list(@Query(new ValidationPipe({ transform: true, whitelist: true })) query: JobsQueryDto) {
    return this.jobs.list(query);
  }

  @Get("facets")
  facets(@Query(new ValidationPipe({ transform: true, whitelist: true })) query: JobFacetsQueryDto) {
    return this.jobs.getFacets(query);
  }

  @Get(":slug/related")
  getRelated(
    @Param("slug") slug: string,
    @Query(new ValidationPipe({ transform: true, whitelist: true })) query: RelatedJobsQueryDto
  ) {
    return this.jobs.getRelated(slug, query.limit);
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
