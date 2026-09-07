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
import { ProfileModule } from "./modules/profile/profile.module";
import { OnboardingModule } from "./modules/onboarding/onboarding.module";
import { AuthModule } from "./auth/auth.module";
import { AdminModule } from "./admin/admin.module";

@Module({
  imports: [
    AppConfigModule,
    LoggingModule,
    QueueModule,
    HealthModule,
    AuthModule,
    AdminModule,
    CompaniesModule,
    JobsModule,
    NewsModule,
    MatchingModule,
    EligibilityModule,
    AlertsModule,
    TrackerModule,
    ProfileModule,
    OnboardingModule
  ]
})
export class AppModule {}
