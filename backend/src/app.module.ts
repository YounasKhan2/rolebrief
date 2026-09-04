import { Module } from "@nestjs/common";
import { AppConfigModule } from "./common/config/app-config.module";
import { LoggingModule } from "./common/logging/logging.module";
import { HealthModule } from "./health/health.module";
import { QueueModule } from "./queue/queue.module";
import { JobsModule } from "./modules/jobs/jobs.module";
import { NewsModule } from "./modules/news/news.module";
import { CompaniesModule } from "./modules/companies/companies.module";
import { MatchingModule } from "./modules/matching/matching.module";
import { EligibilityModule } from "./modules/eligibility/eligibility.module";
import { AlertsModule } from "./modules/alerts/alerts.module";
import { TrackerModule } from "./modules/tracker/tracker.module";

@Module({
  imports: [
    AppConfigModule,
    LoggingModule,
    QueueModule,
    HealthModule,
    CompaniesModule,
    JobsModule,
    NewsModule,
    MatchingModule,
    EligibilityModule,
    AlertsModule,
    TrackerModule
  ]
})
export class AppModule {}
