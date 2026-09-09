import { Injectable } from "@nestjs/common";
import { CandidateEligibilityFacts, JobEligibilityFacts } from "./factual-facts.interface";
import {
  DetailedEligibilityResult,
  DimensionResult,
  ELIGIBILITY_DISCLAIMER,
  EligibilitySummary,
  JobAvailability,
  OverallEligibilityStatus,
  ReasonCode
} from "./reason-codes";
import { TimezoneResolverService } from "./timezone-resolver.service";

@Injectable()
export class EligibilityEvaluatorService {
  constructor(private readonly timezoneResolver: TimezoneResolverService) {}

  /**
   * Evaluates eligibility for a candidate against a job and returns detailed results.
   */
  evaluate(candidate: CandidateEligibilityFacts, job: JobEligibilityFacts): DetailedEligibilityResult {
    const isJobExpired =
      job.jobStatus === "EXPIRED" ||
      Boolean(job.applicationDeadlineAt && job.applicationDeadlineAt < new Date());
    const isJobDelisted = job.jobStatus === "DELISTED";
    const isSuspicious = Boolean(job.flags?.includes("suspicious"));
    const hasApplyUrl = Boolean(job.applicationUrl && job.applicationUrl.trim().length > 0);

    let availabilityStatus: JobAvailability["status"] = "ACTIVE";
    let canApply = true;
    let availabilityReason: string | null = null;

    if (isJobExpired) {
      availabilityStatus = "EXPIRED";
      canApply = false;
      availabilityReason = "Listing has expired; applications are closed.";
    } else if (isJobDelisted) {
      availabilityStatus = "DELISTED";
      canApply = false;
      availabilityReason = "Listing was removed by employer or provider.";
    } else if (isSuspicious) {
      availabilityStatus = "SUSPICIOUS";
      canApply = hasApplyUrl;
      availabilityReason = "Listing flagged for review; verify employer directly.";
    } else if (!hasApplyUrl) {
      canApply = false;
      availabilityReason = "No direct application link available for this role.";
    }

    const jobAvailability: JobAvailability = {
      status: availabilityStatus,
      canApply,
      reason: availabilityReason
    };

    // 1. Check for incomplete profile
    if (!candidate.currentCountry) {
      return this.buildIncompleteProfileResult(candidate, job, jobAvailability);
    }

    // 2. Evaluate 3 factual eligibility dimensions
    const locationDim = this.evaluateLocation(candidate, job);
    const timezoneDim = this.evaluateTimezone(candidate, job);
    const sponsorshipDim = this.evaluateSponsorship(candidate, job, locationDim);

    const dimensions: DimensionResult[] = [locationDim, timezoneDim, sponsorshipDim];

    // 3. Synthesize overall status from factual dimensions
    let overallStatus: OverallEligibilityStatus = "APPEARS_ELIGIBLE";
    let primaryReasonCode = locationDim.reasonCode;
    let badgeText = "Appears eligible";
    let headline = "Appears eligible based on stated requirements";

    const hasConflict = dimensions.some((d) => d.status === "CONFLICT");
    const hasInsufficient = dimensions.some((d) => d.status === "INSUFFICIENT_DATA");
    const hasLikely = dimensions.some((d) => d.status === "LIKELY_SATISFIED");

    if (hasConflict) {
      overallStatus = "CONFLICT";
      const conflictDim = dimensions.find((d) => d.status === "CONFLICT")!;
      primaryReasonCode = conflictDim.reasonCode;
      badgeText = "Eligibility conflict";
      headline = conflictDim.headline;
    } else if (hasInsufficient) {
      overallStatus = "CHECK_REQUIRED";
      const insufficientDim = dimensions.find((d) => d.status === "INSUFFICIENT_DATA")!;
      primaryReasonCode = insufficientDim.reasonCode;
      badgeText = "Check required";
      headline = insufficientDim.headline;
    } else if (hasLikely) {
      overallStatus = "LIKELY_ELIGIBLE";
      badgeText = "Likely eligible";
      headline = "Likely eligible based on profile";
    }

    // 4. Extract unstated facts
    const unstatedFacts: string[] = [];
    if (candidate.requiresVisaSponsorship && sponsorshipDim.reasonCode === ReasonCode.SPON_NEEDED_EMPLOYER_UNSTATED) {
      unstatedFacts.push("Employer sponsorship policy is unstated");
    }
    if (job.unresolvedLabels.length > 0) {
      unstatedFacts.push(`Unverified location restrictions: ${job.unresolvedLabels.join(", ")}`);
    }
    if (!candidate.timezone) {
      unstatedFacts.push("Candidate timezone is not declared in profile");
    }

    return {
      slug: job.slug,
      overallStatus,
      primaryReasonCode,
      badgeText,
      headline,
      jobAvailability,
      isJobExpired: availabilityStatus === "EXPIRED" || availabilityStatus === "DELISTED",
      dimensions,
      knownFacts: {
        candidateResidenceCountry: candidate.currentCountry,
        candidateWorkAuthorizations: candidate.workAuthorizations,
        candidateRequiresSponsorship: candidate.requiresVisaSponsorship,
        candidateTimezone: candidate.timezone,
        jobWorkMode: job.workMode,
        jobRemoteScope: job.remoteScope,
        jobAllowedCountries: job.remoteCountryCodes,
        jobTimezoneOffsets: job.timezoneOffsetMinutes
      },
      unstatedFacts,
      evaluatedAt: new Date().toISOString(),
      disclaimer: ELIGIBILITY_DISCLAIMER
    };
  }

  /**
   * Extracts lightweight summary suitable for catalog/batch responses.
   */
  summarize(detailed: DetailedEligibilityResult): EligibilitySummary {
    return {
      slug: detailed.slug,
      overallStatus: detailed.overallStatus,
      primaryReasonCode: detailed.primaryReasonCode,
      badgeText: detailed.badgeText,
      headline: detailed.headline,
      jobAvailability: detailed.jobAvailability,
      isJobExpired: detailed.isJobExpired
    };
  }

  private evaluateLocation(candidate: CandidateEligibilityFacts, job: JobEligibilityFacts): DimensionResult {
    // 1. Unknown remote scope must NOT silently fall through!
    if (job.remoteScope === "UNKNOWN") {
      return {
        dimension: "LOCATION",
        status: "INSUFFICIENT_DATA",
        reasonCode: ReasonCode.LOC_SCOPE_UNKNOWN_CHECK_REQUIRED,
        headline: "Remote scope unverified",
        details: "Remote scope is not verified by provider; inspection required."
      };
    }

    // 2. Worldwide or timezone-limited with no country restrictions
    const isWorldwideOrTzOnly =
      (job.remoteScope === "WORLDWIDE" || job.remoteScope === "TIMEZONE_LIMITED") &&
      job.remoteCountryCodes.length === 0 &&
      job.unresolvedLabels.length === 0;

    if (isWorldwideOrTzOnly) {
      return {
        dimension: "LOCATION",
        status: "SATISFIED",
        reasonCode: ReasonCode.LOC_WORLDWIDE_NO_RESTRICTIONS,
        headline: "Worldwide remote role",
        details: "Worldwide remote role with no geographical restrictions."
      };
    }

    // 3. Unresolved labels
    if (job.unresolvedLabels.length > 0) {
      return {
        dimension: "LOCATION",
        status: "INSUFFICIENT_DATA",
        reasonCode: ReasonCode.LOC_COUNTRY_UNRESOLVED_INSPECTION,
        headline: "Location requires inspection",
        details: `Role contains unverified location restrictions (${job.unresolvedLabels.join(
          ", "
        )}); manual verification required.`,
        evidence: { unresolvedLabels: job.unresolvedLabels }
      };
    }

    // 4. Country limited or country and timezone limited
    const targetCountries = Array.from(job.remoteCountryCodes);
    const candidateCountry = candidate.currentCountry;
    const authorizations = Array.from(candidate.workAuthorizations);

    // If job has no country restrictions listed
    if (targetCountries.length === 0) {
      return {
        dimension: "LOCATION",
        status: "SATISFIED",
        reasonCode: ReasonCode.LOC_WORLDWIDE_NO_RESTRICTIONS,
        headline: "Worldwide remote role",
        details: "Worldwide remote role with no geographical restrictions."
      };
    }

    // Check authorization in any target country
    const matchingAuth = authorizations.find((code) => targetCountries.includes(code));
    if (matchingAuth) {
      return {
        dimension: "LOCATION",
        status: "SATISFIED",
        reasonCode: ReasonCode.LOC_COUNTRY_AUTHORIZED,
        headline: `Authorized in allowed country (${matchingAuth})`,
        details: `Candidate self-reported work authorization in allowed country (${matchingAuth}).`,
        evidence: { matchingCountry: matchingAuth }
      };
    }

    // Check residence country
    if (candidateCountry && targetCountries.includes(candidateCountry)) {
      return {
        dimension: "LOCATION",
        status: "SATISFIED",
        reasonCode: ReasonCode.LOC_COUNTRY_CITIZEN_RESIDENT,
        headline: `Resides in allowed country (${candidateCountry})`,
        details: `Candidate resides in allowed country (${candidateCountry}).`,
        evidence: { residentCountry: candidateCountry }
      };
    }

    // Conflict
    return {
      dimension: "LOCATION",
      status: "CONFLICT",
      reasonCode: ReasonCode.LOC_COUNTRY_NOT_AUTHORIZED,
      headline: "Location authorization conflict",
      details: `Candidate does not report work authorization in any required country: ${targetCountries.join(", ")}.`,
      evidence: {
        requiredCountries: targetCountries,
        candidateResidence: candidateCountry,
        candidateAuthorizations: authorizations
      }
    };
  }

  private evaluateTimezone(candidate: CandidateEligibilityFacts, job: JobEligibilityFacts): DimensionResult {
    const tzResult = this.timezoneResolver.evaluate(candidate.timezone, job.timezoneOffsetMinutes);
    return {
      dimension: "TIMEZONE",
      status: tzResult.status,
      reasonCode: tzResult.reasonCode,
      headline: tzResult.headline,
      details: tzResult.details,
      evidence: {
        candidateOffset: tzResult.candidateCurrentOffset,
        declaredOffsets: tzResult.declaredOffsets
      }
    };
  }

  private evaluateSponsorship(
    candidate: CandidateEligibilityFacts,
    job: JobEligibilityFacts,
    locationDim: DimensionResult
  ): DimensionResult {
    const isWorldwideOrTzOnly =
      (job.remoteScope === "WORLDWIDE" || job.remoteScope === "TIMEZONE_LIMITED") &&
      job.remoteCountryCodes.length === 0 &&
      job.unresolvedLabels.length === 0;

    // Jurisdiction-specific lock: If candidate is authorized in target jurisdiction, sponsorship is not needed
    if (isWorldwideOrTzOnly || locationDim.status === "SATISFIED") {
      return {
        dimension: "SPONSORSHIP",
        status: "SATISFIED",
        reasonCode: ReasonCode.SPON_SELF_AUTHORIZED_IN_TARGET,
        headline: "Sponsorship not required",
        details: "Candidate is authorized in destination jurisdiction; visa sponsorship is not needed for this role."
      };
    }

    // If candidate does not need sponsorship
    if (candidate.requiresVisaSponsorship === false) {
      return {
        dimension: "SPONSORSHIP",
        status: "SATISFIED",
        reasonCode: ReasonCode.SPON_NOT_REQUIRED_BY_CANDIDATE,
        headline: "Sponsorship not required",
        details: "Candidate self-reported that they do not require visa sponsorship."
      };
    }

    // Candidate reports needing sponsorship and is not authorized in target jurisdiction
    return {
      dimension: "SPONSORSHIP",
      status: "INSUFFICIENT_DATA",
      reasonCode: ReasonCode.SPON_NEEDED_EMPLOYER_UNSTATED,
      headline: "Sponsorship policy unstated",
      details: "Candidate self-reported requiring sponsorship, but employer sponsorship policy is unstated; confirmation required."
    };
  }

  private buildIncompleteProfileResult(
    candidate: CandidateEligibilityFacts,
    job: JobEligibilityFacts,
    jobAvailability: JobAvailability
  ): DetailedEligibilityResult {
    const dimensions: DimensionResult[] = [
      {
        dimension: "LOCATION",
        status: "INSUFFICIENT_DATA",
        reasonCode: ReasonCode.LOC_CANDIDATE_COUNTRY_UNSPECIFIED,
        headline: "Profile incomplete",
        details: "Candidate country of residence is not specified in profile."
      },
      {
        dimension: "TIMEZONE",
        status: "INSUFFICIENT_DATA",
        reasonCode: ReasonCode.TZ_CANDIDATE_UNSPECIFIED,
        headline: "Profile incomplete",
        details: "Candidate timezone is not specified in profile."
      },
      {
        dimension: "SPONSORSHIP",
        status: "INSUFFICIENT_DATA",
        reasonCode: ReasonCode.SPON_NEEDED_EMPLOYER_UNSTATED,
        headline: "Profile incomplete",
        details: "Candidate sponsorship status is not specified in profile."
      }
    ];

    return {
      slug: job.slug,
      overallStatus: "NOT_CALCULATED",
      primaryReasonCode: ReasonCode.PROFILE_INCOMPLETE,
      badgeText: "Profile incomplete",
      headline: "Complete your profile to evaluate eligibility",
      jobAvailability,
      isJobExpired: jobAvailability.status === "EXPIRED" || jobAvailability.status === "DELISTED",
      dimensions,
      knownFacts: {
        candidateResidenceCountry: null,
        candidateWorkAuthorizations: candidate.workAuthorizations,
        candidateRequiresSponsorship: candidate.requiresVisaSponsorship,
        candidateTimezone: candidate.timezone,
        jobWorkMode: job.workMode,
        jobRemoteScope: job.remoteScope,
        jobAllowedCountries: job.remoteCountryCodes,
        jobTimezoneOffsets: job.timezoneOffsetMinutes
      },
      unstatedFacts: ["Candidate residence country is missing from profile"],
      evaluatedAt: new Date().toISOString(),
      disclaimer: ELIGIBILITY_DISCLAIMER
    };
  }
}

