import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import {
  AlertCadence,
  AlertChannel,
  AlertEligibilityPolicy,
  AlertMatchEmailState,
  AlertMatchNotificationState,
  AlertStatus,
  EmailDeliveryStatus,
  OutboxStatus,
  Prisma,
  WorkMode
} from "@prisma/client";
import { Job, UnrecoverableError } from "bullmq";
import { PrismaService } from "../../prisma/prisma.service";
import { AppConfigService } from "../../common/config/app-config.service";
import {
  EVALUATE_JOB_ALERTS_JOB,
  QUEUES,
  SEND_AUTH_EMAIL_JOB
} from "../../queue/queue.constants";
import { MatchBriefEvaluatorService } from "../matching/match-brief-evaluator.service";
import { EligibilityEvaluatorService } from "../eligibility/eligibility-evaluator.service";
import { EligibilityService } from "../eligibility/eligibility.service";
import { MatchBriefsService } from "../matching/match-briefs.service";
import { generateAlertUnsubscribeToken } from "./alert-unsubscribe.util";
import { AlertCriteriaV1 } from "./alerts.types";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { createHash } from "node:crypto";

export interface EvaluateJobAlertsData {
  outboxEventId: string;
  jobId: string;
}

@Injectable()
@Processor(QUEUES.alerts)
export class AlertEvaluationProcessor extends WorkerHost {
  private readonly logger = new Logger(AlertEvaluationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly matchBriefEvaluator: MatchBriefEvaluatorService,
    private readonly eligibilityEvaluator: EligibilityEvaluatorService,
    private readonly eligibilityService: EligibilityService,
    @InjectQueue(QUEUES.delivery) private readonly deliveryQueue: Queue
  ) {
    super();
  }

  async process(job: Job) {
    if (job.name !== EVALUATE_JOB_ALERTS_JOB) {
      return { skipped: true, reason: `Unsupported alerts job: ${job.name}` };
    }

    const { outboxEventId, jobId } = job.data as EvaluateJobAlertsData;
    if (!jobId) {
      throw new UnrecoverableError("Missing jobId in alert evaluation task.");
    }

    // 1. Fetch the target job with relations needed for evaluation
    const jobEntity = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        company: true,
        salaries: true,
        source: true,
        locations: { include: { location: true } }
      }
    });

    if (!jobEntity) {
      this.logger.warn(`Job ${jobId} not found during alert evaluation.`);
      if (outboxEventId) {
        await this.prisma.jobOutboxEvent.update({
          where: { id: outboxEventId },
          data: { status: OutboxStatus.PROCESSED }
        }).catch(() => undefined);
      }
      return { skipped: true, reason: "job_not_found" };
    }

    // Convert to factual interfaces
    const jobEligibilityFacts = this.eligibilityService.toJobFacts(jobEntity);
    const salary = jobEntity.salaries[0];
    const jobMatchFacts = {
      id: jobEntity.id,
      slug: jobEntity.slug,
      title: jobEntity.canonicalTitle,
      seniority: jobEntity.seniority,
      employmentType: jobEntity.employmentType,
      workMode: jobEntity.workMode,
      salary: salary
        ? {
            min: salary.min,
            max: salary.max,
            currency: salary.currency,
            period: salary.period
          }
        : null
    };

    const hasSalary = Boolean(jobEntity.salaries && jobEntity.salaries.length > 0 && (salary?.min != null || salary?.max != null));
    const locationAlpha2s: string[] = [...jobEligibilityFacts.remoteCountryCodes];

    // 2. Stage 1 SQL Envelope Prefilter
    // Retrieve only ACTIVE alerts whose criteria envelopes can contain this job
    const andFilters: Prisma.AlertWhereInput[] = [
      // workModes: empty in alert means any workMode, otherwise must contain job.workMode
      {
        OR: [
          { workModes: { isEmpty: true } },
          { workModes: { has: jobEntity.workMode } }
        ]
      }
    ];

    if (!hasSalary) {
      andFilters.push({
        OR: [
          { salaryDisclosed: null },
          { salaryDisclosed: false }
        ]
      });
    }

    if (locationAlpha2s.length > 0) {
      andFilters.push({
        OR: [
          { countryCodes: { isEmpty: true } },
          { countryCodes: { hasSome: locationAlpha2s } }
        ]
      });
    }

    const candidateAlerts = await this.prisma.alert.findMany({
      where: {
        status: AlertStatus.ACTIVE,
        AND: andFilters
      },
      include: {
        user: {
          include: {
            profile: {
              include: { preferences: true }
            }
          }
        }
      }
    });

    if (candidateAlerts.length === 0) {
      if (outboxEventId) {
        await this.prisma.jobOutboxEvent.update({
          where: { id: outboxEventId },
          data: { status: OutboxStatus.PROCESSED }
        }).catch(() => undefined);
      }
      return { evaluatedAlerts: 0, matchedAlerts: 0 };
    }

    let matchedCount = 0;

    // 3. Stage 2 Deterministic In-Process Evaluation for each candidate alert
    for (const alert of candidateAlerts) {
      try {
        const criteria = alert.criteriaJson as unknown as AlertCriteriaV1;
        const user = alert.user;
        const profile = user.profile;

        // Verify title match if targetTitles specified in alert criteria
        if (criteria.targetTitles && criteria.targetTitles.length > 0) {
          const matchResult = this.matchBriefEvaluator.evaluate(
            {
              userId: user.id,
              revision: profile?.revision ?? 0,
              targetRoleTitles: criteria.targetTitles,
              seniorityLevel: profile?.seniorityLevel ?? null,
              remotePreference: profile?.preferences?.remotePreference ?? null,
              employmentTypes: profile?.preferences?.employmentTypes ?? [],
              minSalary: profile?.preferences?.minSalary ?? null,
              maxSalary: profile?.preferences?.maxSalary ?? null,
              salaryCurrency: profile?.preferences?.salaryCurrency ?? null,
              salaryPeriod: profile?.preferences?.salaryPeriod ?? null
            },
            jobMatchFacts
          );

          // Check if title matched or was at least partial
          const titleDimension = matchResult.dimensions.find((d) => d.dimension === "TITLE");
          if (!titleDimension || (titleDimension.status !== "MATCH" && titleDimension.status !== "PARTIAL")) {
            continue;
          }

          // Check alignment tier requirement
          if (criteria.alignment === "STRONG_ALIGNMENT" && matchResult.status !== "STRONG_ALIGNMENT") {
            continue;
          }
          if (
            criteria.alignment === "PARTIAL_ALIGNMENT" &&
            matchResult.status !== "STRONG_ALIGNMENT" &&
            matchResult.status !== "PARTIAL_ALIGNMENT"
          ) {
            continue;
          }
        }

        // Evaluate Eligibility Shield
        const candidateEligibilityFacts = {
          userId: user.id,
          currentCountry: profile?.currentCountry ?? null,
          workAuthorizations: profile?.workAuthorizations ?? [],
          requiresVisaSponsorship: profile?.requiresVisaSponsorship ?? null,
          timezone: user.timezone ?? null,
          revision: profile?.revision ?? 0
        };

        const eligibilityDetail = this.eligibilityEvaluator.evaluate(candidateEligibilityFacts, jobEligibilityFacts);

        // Gate NO_KNOWN_CONFLICTS: only APPEARS_ELIGIBLE or LIKELY_ELIGIBLE pass
        if (alert.eligibilityPolicy === AlertEligibilityPolicy.NO_KNOWN_CONFLICTS) {
          const status = eligibilityDetail.overallStatus;
          if (status !== "APPEARS_ELIGIBLE" && status !== "LIKELY_ELIGIBLE") {
            continue;
          }
        }

        // Job matches alert criteria! Insert AlertMatch (deduplicated on alertId + jobId)
        const matchRecord = await this.prisma.alertMatch.upsert({
          where: {
            alertId_jobId: {
              alertId: alert.id,
              jobId: jobEntity.id
            }
          },
          create: {
            alertId: alert.id,
            jobId: jobEntity.id,
            userId: alert.userId,
            criteriaVersion: alert.criteriaVersion,
            eligibilityStatus: eligibilityDetail.overallStatus,
            reasonsSummary: eligibilityDetail.dimensions.map((d) => `${d.dimension}:${d.status}:${d.reasonCode}`),
            notificationState: AlertMatchNotificationState.PENDING,
            emailState: AlertMatchEmailState.PENDING
          },
          update: {} // Idempotent: don't overwrite on duplicates
        });

        matchedCount++;

        // 4. In-App Notification Delivery
        if (alert.channel === AlertChannel.IN_APP || alert.channel === AlertChannel.BOTH) {
          const dedupeKey = `alert:${alert.id}:${jobEntity.id}`;
          try {
            const notif = await this.prisma.notification.upsert({
              where: { dedupeKey },
              create: {
                userId: alert.userId,
                type: "JOB_ALERT",
                title: `New match for "${alert.name}"`,
                body: `${jobEntity.canonicalTitle} at ${jobEntity.company?.canonicalName ?? "Unknown"}`,
                linkUrl: `/app/jobs/${jobEntity.slug}`,
                dedupeKey,
                metadata: {
                  alertId: alert.id,
                  jobId: jobEntity.id,
                  jobSlug: jobEntity.slug,
                  companyName: jobEntity.company?.canonicalName ?? null,
                  eligibilityStatus: eligibilityDetail.overallStatus
                }
              },
              update: {}
            });

            await this.prisma.alertMatch.update({
              where: { id: matchRecord.id },
              data: {
                notificationState: AlertMatchNotificationState.CREATED,
                notificationId: notif.id
              }
            });
          } catch (notifErr: any) {
            this.logger.warn(`Failed to create notification for alert match ${matchRecord.id}: ${notifErr.message}`);
          }
        }

        // 5. Immediate Email Delivery
        if (
          (alert.channel === AlertChannel.EMAIL || alert.channel === AlertChannel.BOTH) &&
          alert.cadence === AlertCadence.IMMEDIATE
        ) {
          await this.queueImmediateEmail(alert, user, jobEntity, eligibilityDetail.overallStatus, matchRecord.id);
        }

        // Update alert lastEvaluatedAt
        await this.prisma.alert.update({
          where: { id: alert.id },
          data: { lastEvaluatedAt: new Date() }
        }).catch(() => undefined);
      } catch (evalErr: any) {
        this.logger.error(`Error evaluating alert ${alert.id} for job ${jobEntity.id}: ${evalErr.message}`, evalErr.stack);
      }
    }

    if (outboxEventId) {
      await this.prisma.jobOutboxEvent.update({
        where: { id: outboxEventId },
        data: { status: OutboxStatus.PROCESSED }
      }).catch(() => undefined);
    }

    return { evaluatedAlerts: candidateAlerts.length, matchedAlerts: matchedCount };
  }

  private async queueImmediateEmail(
    alert: any,
    user: any,
    job: any,
    eligibilityStatus: string,
    matchRecordId: string
  ) {
    if (!this.config.auth.email.deliveryEnabled) {
      return;
    }

    const frontendOrigin = this.config.auth.frontendOrigin;
    const viewUrl = `${frontendOrigin}/app/jobs/${job.slug}`;
    const unsubscribeToken = generateAlertUnsubscribeToken(
      alert.id,
      user.id,
      this.config.cursorSigningSecret,
      "pause"
    );
    const unsubscribeUrl = `${this.config.publicAppUrl}/api/v1/alerts/unsubscribe/${unsubscribeToken}`;

    const salary = job.salaries?.[0];
    const salaryText = salary
      ? `${salary.currency ?? "$"} ${salary.min?.toLocaleString() ?? ""}${salary.max ? ` - ${salary.max.toLocaleString()}` : ""} ${salary.period ?? ""}`.trim()
      : undefined;

    const locationsText = job.remoteCountryCodes?.join(", ");

    const payload = {
      alertName: alert.name,
      role: {
        title: job.canonicalTitle,
        companyName: job.company?.canonicalName ?? "Unknown",
        workMode: job.workMode,
        locationsText,
        salaryText,
        eligibilityStatus,
        viewUrl
      },
      unsubscribeUrl
    };

    const dedupeKey = createHash("sha256")
      .update(`alert-match:${alert.id}:${job.id}`)
      .digest("hex");

    try {
      const delivery = await this.prisma.emailDelivery.upsert({
        where: { dedupeKey },
        create: {
          userId: user.id,
          toEmail: user.email,
          template: "alert-match",
          subject: `Matched Role: ${job.canonicalTitle} at ${job.company?.canonicalName ?? "Unknown"}`,
          provider: this.config.auth.email.provider,
          dedupeKey,
          status: EmailDeliveryStatus.QUEUED
        },
        update: {}
      });

      await this.deliveryQueue.add(
        SEND_AUTH_EMAIL_JOB,
        {
          deliveryId: delivery.id,
          alertId: alert.id,
          jobId: job.id,
          matchRecordId,
          payload
        },
        {
          jobId: delivery.id,
          attempts: 4,
          backoff: { type: "exponential", delay: 30_000 },
          removeOnComplete: 1000,
          removeOnFail: 1000
        }
      );

      await this.prisma.alertMatch.update({
        where: { id: matchRecordId },
        data: {
          emailState: AlertMatchEmailState.SENT,
          emailDeliveryId: delivery.id
        }
      });
    } catch (err: any) {
      this.logger.error(`Failed to queue immediate email for alert ${alert.id}: ${err.message}`, err.stack);
    }
  }
}
