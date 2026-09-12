import { Module } from "@nestjs/common";
import { AppConfigModule } from "./common/config/app-config.module";
import { LoggingModule } from "./common/logging/logging.module";
import { PrismaModule } from "./prisma/prisma.module";
import { QueueModule } from "./queue/queue.module";
import { IngestionModule } from "./ingestion/ingestion.module";
import { ProvidersModule } from "./providers/providers.module";
import { EmailModule } from "./auth/email/email.module";
import { EmailDeliveryProcessor } from "./auth/email/email.processor";
import { MatchingModule } from "./modules/matching/matching.module";
import { EligibilityModule } from "./modules/eligibility/eligibility.module";
import { AlertEvaluationProcessor } from "./modules/alerts/alert-evaluation.processor";
import { AlertsModule } from "./modules/alerts/alerts.module";
import { ResumesModule } from "./modules/resumes/resumes.module";
import { ResumeVerificationProcessor } from "./modules/resumes/processing/resume-verification.processor";

@Module({
  imports: [
    AppConfigModule,
    LoggingModule,
    PrismaModule,
    QueueModule,
    ProvidersModule,
    IngestionModule,
    EmailModule,
    MatchingModule,
    EligibilityModule,
    AlertsModule,
    ResumesModule
  ],
  providers: [EmailDeliveryProcessor, AlertEvaluationProcessor, ResumeVerificationProcessor]
})
export class WorkerModule {}
