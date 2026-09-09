import { Injectable } from "@nestjs/common";
import { EmploymentType, RemotePreference, SalaryPeriod, SeniorityLevel, WorkMode } from "@prisma/client";
import { CandidateMatchFacts, JobMatchFacts } from "./match-brief.types";
import {
  MatchBriefDetail,
  MatchBriefSummary,
  MatchDimension,
  MatchDimensionResult,
  MatchDimensionState,
  MatchEvidenceSummary
} from "./reason-codes";
import {
  MATCH_BRIEF_ENGINE_VERSION,
  MATCH_BRIEF_TAXONOMY_VERSION,
  hasConservativePartialTitleMatch,
  normalizeTitleForMatch
} from "./title-taxonomy";
import { computeJobMatchVersion } from "./job-match-version";

const APPROVED_DIMENSION_COUNT = 5;

@Injectable()
export class MatchBriefEvaluatorService {
  evaluate(candidate: CandidateMatchFacts, job: JobMatchFacts): MatchBriefDetail {
    const dimensions = [
      this.evaluateTitle(candidate, job),
      this.evaluateSeniority(candidate, job),
      this.evaluateEmploymentType(candidate, job),
      this.evaluateWorkMode(candidate, job),
      this.evaluateCompensation(candidate, job)
    ];

    const comparable = dimensions.filter((d) => ["MATCH", "PARTIAL", "GAP"].includes(d.status));
    const unknownApplicable = dimensions.filter((d) => d.status === "UNKNOWN");
    const matchCount = comparable.filter((d) => d.status === "MATCH").length;
    const partialCount = comparable.filter((d) => d.status === "PARTIAL").length;
    const gapCount = comparable.filter((d) => d.status === "GAP").length;

    const status = comparable.length < 2
      ? "NOT_CALCULATED"
      : gapCount >= 2 || (gapCount === 1 && matchCount === 0)
        ? "LIMITED_ALIGNMENT"
        : gapCount === 0 && matchCount >= 2 && partialCount <= 1
          ? "STRONG_ALIGNMENT"
          : "PARTIAL_ALIGNMENT";

    const denominator = comparable.length + unknownApplicable.length;
    const coveragePercent = denominator === 0 ? 0 : Math.round((comparable.length / denominator) * 100);
    const primaryReasonCode = status === "NOT_CALCULATED"
      ? "INSUFFICIENT_COMPARABLE_DIMENSIONS"
      : this.primaryReason(dimensions);

    const base = {
      engineVersion: MATCH_BRIEF_ENGINE_VERSION,
      taxonomyVersion: MATCH_BRIEF_TAXONOMY_VERSION,
      jobSlug: job.slug,
      status,
      label: this.label(status),
      scorePercent: null,
      coveragePercent,
      comparableDimensionCount: comparable.length,
      primaryReasonCode,
      strengths: this.summaries(dimensions.filter((d) => d.status === "MATCH" || d.status === "PARTIAL")),
      gaps: this.summaries(dimensions.filter((d) => d.status === "GAP")),
      unknowns: this.summaries(dimensions.filter((d) => d.status === "UNKNOWN")),
      profileRevision: candidate.revision,
      jobMatchVersion: computeJobMatchVersion(job),
      calculatedAt: new Date().toISOString()
    } satisfies MatchBriefSummary;

    return { ...base, dimensions };
  }

  summarize(detail: MatchBriefDetail): MatchBriefSummary {
    const { dimensions: _dimensions, ...summary } = detail;
    return summary;
  }

  private evaluateTitle(candidate: CandidateMatchFacts, job: JobMatchFacts): MatchDimensionResult {
    const targets = candidate.targetRoleTitles.map((t) => t.trim()).filter(Boolean);
    if (targets.length === 0) return this.result("TITLE", "UNKNOWN", "TITLE_CANDIDATE_MISSING", "Target role", "Not specified", "Job title", job.title, "Add target role titles to calculate title alignment.");
    if (!job.title.trim()) return this.result("TITLE", "UNKNOWN", "TITLE_JOB_MISSING", "Target role", targets.join(", "), "Job title", "Not specified", "The employer did not provide a comparable title.");

    const normalizedJob = normalizeTitleForMatch(job.title);
    for (const target of targets) {
      const normalizedTarget = normalizeTitleForMatch(target);
      if (normalizedTarget === normalizedJob) {
        return this.result("TITLE", "MATCH", "TITLE_EXACT_MATCH", "Target role", target, "Job title", job.title, "The job title matches one of your target roles.");
      }
    }
    for (const target of targets) {
      if (hasConservativePartialTitleMatch(target, job.title)) {
        return this.result("TITLE", "PARTIAL", "TITLE_CONTROLLED_PARTIAL_MATCH", "Target role", target, "Job title", job.title, "The title shares a conservative approved role-title pattern.");
      }
    }
    return this.result("TITLE", "GAP", "TITLE_KNOWN_MISMATCH", "Target role", targets.join(", "), "Job title", job.title, "The job title does not match your declared target roles.");
  }

  private evaluateSeniority(candidate: CandidateMatchFacts, job: JobMatchFacts): MatchDimensionResult {
    const candidateLevel = mapCandidateSeniority(candidate.seniorityLevel);
    const jobLevels = mapJobSeniorities(job.seniority);
    if (candidateLevel === "UNKNOWN") return this.result("SENIORITY", "UNKNOWN", "SENIORITY_CANDIDATE_MISSING", "Target seniority", "Not specified", "Job seniority", job.seniority ?? "Not specified", "Add a target seniority level to compare seniority.");
    if (jobLevels.length === 0) return this.result("SENIORITY", "UNKNOWN", "SENIORITY_JOB_MISSING", "Target seniority", candidateLevel, "Job seniority", "Not specified", "The employer did not provide structured seniority.");
    if (jobLevels.includes(candidateLevel)) return this.result("SENIORITY", "MATCH", "SENIORITY_EXACT_MATCH", "Target seniority", candidateLevel, "Job seniority", job.seniority ?? "Not specified", "The job seniority matches your target level.");
    if (jobLevels.some((level) => Math.abs(SENIORITY_RANK[level] - SENIORITY_RANK[candidateLevel]) === 1)) {
      return this.result("SENIORITY", "PARTIAL", "SENIORITY_ADJACENT_PARTIAL", "Target seniority", candidateLevel, "Job seniority", job.seniority ?? "Not specified", "The job seniority is adjacent to your target level.");
    }
    return this.result("SENIORITY", "GAP", "SENIORITY_CONFIRMED_GAP", "Target seniority", candidateLevel, "Job seniority", job.seniority ?? "Not specified", "The job seniority is materially different from your target level.");
  }

  private evaluateEmploymentType(candidate: CandidateMatchFacts, job: JobMatchFacts): MatchDimensionResult {
    const candidateTypes = candidate.employmentTypes;
    const jobType = mapJobEmploymentType(job.employmentType);
    if (candidateTypes.length === 0) return this.result("EMPLOYMENT_TYPE", "UNKNOWN", "EMPLOYMENT_TYPE_CANDIDATE_MISSING", "Employment preference", "Not specified", "Job type", job.employmentType ?? "Not specified", "Add acceptable employment types to compare this role.");
    if (!jobType) return this.result("EMPLOYMENT_TYPE", "UNKNOWN", "EMPLOYMENT_TYPE_JOB_MISSING", "Employment preference", candidateTypes.join(", "), "Job type", "Not specified", "The employer did not provide a comparable employment type.");
    if (candidateTypes.includes(jobType)) return this.result("EMPLOYMENT_TYPE", "MATCH", "EMPLOYMENT_TYPE_MATCH", "Employment preference", candidateTypes.join(", "), "Job type", jobType, "The role uses an employment type you selected.");
    return this.result("EMPLOYMENT_TYPE", "GAP", "EMPLOYMENT_TYPE_EXCLUDED", "Employment preference", candidateTypes.join(", "), "Job type", jobType, "This employment type is outside your selected preferences.");
  }

  private evaluateWorkMode(candidate: CandidateMatchFacts, job: JobMatchFacts): MatchDimensionResult {
    if (!candidate.remotePreference) return this.result("WORK_MODE", "UNKNOWN", "WORK_MODE_CANDIDATE_MISSING", "Work-mode preference", "Not specified", "Job work mode", job.workMode, "Add a work-mode preference to compare this role.");
    if (job.workMode === WorkMode.UNKNOWN) return this.result("WORK_MODE", "UNKNOWN", "WORK_MODE_JOB_MISSING", "Work-mode preference", candidate.remotePreference, "Job work mode", "Unknown", "The employer did not provide a comparable work mode.");
    const accepted = acceptedWorkModes(candidate.remotePreference);
    if (accepted.includes(job.workMode)) return this.result("WORK_MODE", "MATCH", "WORK_MODE_MATCH", "Work-mode preference", candidate.remotePreference, "Job work mode", job.workMode, "The role matches your work-mode preference.");
    return this.result("WORK_MODE", "GAP", "WORK_MODE_EXCLUDED", "Work-mode preference", candidate.remotePreference, "Job work mode", job.workMode, "This work mode is outside your selected preference.");
  }

  private evaluateCompensation(candidate: CandidateMatchFacts, job: JobMatchFacts): MatchDimensionResult {
    const candLabel = formatCandidateSalary(candidate);
    const jobLabel = formatJobSalary(job.salary);
    if (candidate.minSalary == null && candidate.maxSalary == null) return this.result("COMPENSATION", "UNKNOWN", "COMPENSATION_CANDIDATE_MISSING", "Compensation preference", "Not specified", "Employer salary", jobLabel, "Add compensation preferences to compare salary.");
    if (!job.salary || (job.salary.min == null && job.salary.max == null)) return this.result("COMPENSATION", "UNKNOWN", "COMPENSATION_MISSING", "Compensation preference", candLabel, "Employer salary", "Not disclosed", "The employer did not disclose comparable compensation.");
    if (!candidate.salaryCurrency || !job.salary.currency || candidate.salaryCurrency.toUpperCase() !== job.salary.currency.toUpperCase()) return this.result("COMPENSATION", "UNKNOWN", "COMPENSATION_CURRENCY_MISMATCH", "Compensation preference", candLabel, "Employer salary", jobLabel, "Currency differs or is unavailable, so no conversion was attempted.");
    if (!candidate.salaryPeriod || !job.salary.period || normalizePeriod(job.salary.period) !== candidate.salaryPeriod) return this.result("COMPENSATION", "UNKNOWN", "COMPENSATION_PERIOD_MISMATCH", "Compensation preference", candLabel, "Employer salary", jobLabel, "Salary periods differ or are unavailable, so no conversion was attempted.");

    const candMin = candidate.minSalary;
    const candMax = candidate.maxSalary;
    const jobMin = job.salary.min;
    const jobMax = job.salary.max;
    if (candMin != null && jobMax != null && jobMax < candMin) return this.result("COMPENSATION", "GAP", "COMPENSATION_BELOW_MINIMUM", "Compensation preference", candLabel, "Employer salary", jobLabel, "The disclosed maximum is below your minimum preference.");
    if (candMin != null && (jobMin == null || jobMin < candMin) && (jobMax == null || jobMax >= candMin)) return this.result("COMPENSATION", "PARTIAL", "COMPENSATION_PARTIAL_OVERLAP", "Compensation preference", candLabel, "Employer salary", jobLabel, "The disclosed range partially overlaps your preference.");
    if (candMax != null && jobMin != null && jobMin > candMax) return this.result("COMPENSATION", "PARTIAL", "COMPENSATION_PARTIAL_OVERLAP", "Compensation preference", candLabel, "Employer salary", jobLabel, "The disclosed range starts above your stated maximum.");
    return this.result("COMPENSATION", "MATCH", "COMPENSATION_MATCH", "Compensation preference", candLabel, "Employer salary", jobLabel, "The disclosed compensation is comparable with your preference.");
  }

  private result(dimension: MatchDimension, status: MatchDimensionState, reasonCode: string, candidateLabel: string, candidateValue: string, jobLabel: string, jobValue: string, explanation: string): MatchDimensionResult {
    return {
      dimension,
      status,
      reasonCode,
      candidateFact: { label: candidateLabel, value: bound(candidateValue), provenance: candidateValue === "Not specified" ? "UNAVAILABLE" : "USER_DECLARED" },
      jobFact: { label: jobLabel, value: bound(jobValue), provenance: jobValue === "Not specified" || jobValue === "Unknown" || jobValue === "Not disclosed" ? "UNAVAILABLE" : "PROVIDER_STRUCTURED" },
      explanation: bound(explanation, 240)
    };
  }

  private summaries(results: MatchDimensionResult[]): MatchEvidenceSummary[] {
    return results.slice(0, 3).map((result) => ({
      dimension: result.dimension,
      reasonCode: result.reasonCode,
      label: result.explanation
    }));
  }

  private primaryReason(dimensions: MatchDimensionResult[]) {
    return dimensions.find((d) => d.status === "GAP")?.reasonCode
      ?? dimensions.find((d) => d.status === "MATCH")?.reasonCode
      ?? dimensions.find((d) => d.status === "PARTIAL")?.reasonCode
      ?? dimensions.find((d) => d.status === "UNKNOWN")?.reasonCode
      ?? "INSUFFICIENT_COMPARABLE_DIMENSIONS";
  }

  private label(status: MatchBriefSummary["status"]): string {
    if (status === "STRONG_ALIGNMENT") return "Strong alignment";
    if (status === "PARTIAL_ALIGNMENT") return "Partial alignment";
    if (status === "LIMITED_ALIGNMENT") return "Limited alignment";
    return "Not calculated";
  }
}

type CanonicalSeniority = "ENTRY" | "JUNIOR" | "MID" | "SENIOR" | "LEAD" | "MANAGER" | "EXECUTIVE";

const SENIORITY_RANK: Record<CanonicalSeniority, number> = {
  ENTRY: 1,
  JUNIOR: 2,
  MID: 3,
  SENIOR: 4,
  LEAD: 5,
  MANAGER: 6,
  EXECUTIVE: 7
};

function mapCandidateSeniority(value: SeniorityLevel | null): CanonicalSeniority | "UNKNOWN" {
  if (!value) return "UNKNOWN";
  if (value === SeniorityLevel.PRINCIPAL) return "LEAD";
  if (value === SeniorityLevel.DIRECTOR) return "MANAGER";
  return value as CanonicalSeniority;
}

function mapJobSeniorities(value: string | null): CanonicalSeniority[] {
  if (!value) return [];
  const normalized = value.toUpperCase();
  const levels: CanonicalSeniority[] = [];
  if (/\b(INTERN|ENTRY)\b/.test(normalized)) levels.push("ENTRY");
  if (/\b(JUNIOR|JR)\b/.test(normalized)) levels.push("JUNIOR");
  if (/\b(MID|INTERMEDIATE)\b/.test(normalized)) levels.push("MID");
  if (/\b(SENIOR|SR)\b/.test(normalized)) levels.push("SENIOR");
  if (/\b(LEAD|STAFF|PRINCIPAL)\b/.test(normalized)) levels.push("LEAD");
  if (/\b(MANAGER|DIRECTOR|HEAD)\b/.test(normalized)) levels.push("MANAGER");
  if (/\b(EXECUTIVE|VP|C[- ]?LEVEL|CHIEF)\b/.test(normalized)) levels.push("EXECUTIVE");
  return Array.from(new Set(levels));
}

function mapJobEmploymentType(value: string | null): EmploymentType | null {
  if (!value) return null;
  const normalized = value.toUpperCase().replace(/[-\s]+/g, "_");
  if (normalized.includes("FULL_TIME") || normalized === "FULLTIME") return EmploymentType.FULL_TIME;
  if (normalized.includes("PART_TIME") || normalized === "PARTTIME") return EmploymentType.PART_TIME;
  if (normalized.includes("CONTRACT")) return EmploymentType.CONTRACT;
  if (normalized.includes("INTERN")) return EmploymentType.INTERNSHIP;
  if (normalized.includes("TEMP")) return EmploymentType.TEMPORARY;
  return null;
}

function acceptedWorkModes(preference: RemotePreference): WorkMode[] {
  if (preference === RemotePreference.OPEN_TO_ANY) return [WorkMode.REMOTE, WorkMode.HYBRID, WorkMode.ONSITE];
  if (preference === RemotePreference.REMOTE_ONLY) return [WorkMode.REMOTE];
  if (preference === RemotePreference.HYBRID) return [WorkMode.HYBRID, WorkMode.REMOTE];
  return [WorkMode.ONSITE];
}

function normalizePeriod(value: string): SalaryPeriod | null {
  const normalized = value.toUpperCase();
  if (normalized.includes("YEAR") || normalized.includes("ANNUAL")) return SalaryPeriod.ANNUAL;
  if (normalized.includes("MONTH")) return SalaryPeriod.MONTHLY;
  if (normalized.includes("HOUR")) return SalaryPeriod.HOURLY;
  return null;
}

function formatCandidateSalary(candidate: CandidateMatchFacts): string {
  const range = [candidate.minSalary, candidate.maxSalary].filter((v) => v != null).map((v) => Number(v).toLocaleString()).join("-");
  if (!range) return "Not specified";
  return `${candidate.salaryCurrency ?? "currency not specified"} ${range}${candidate.salaryPeriod ? ` / ${candidate.salaryPeriod.toLowerCase()}` : ""}`;
}

function formatJobSalary(salary: JobMatchFacts["salary"]): string {
  if (!salary || (salary.min == null && salary.max == null)) return "Not disclosed";
  const range = [salary.min, salary.max].filter((v) => v != null).map((v) => Number(v).toLocaleString()).join("-");
  return `${salary.currency ?? "currency not specified"} ${range}${salary.period ? ` / ${salary.period.toLowerCase()}` : ""}`;
}

function bound(value: string, max = 160): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

