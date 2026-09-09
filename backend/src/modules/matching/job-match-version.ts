import { createHash } from "node:crypto";
import { MATCH_BRIEF_TAXONOMY_VERSION } from "./title-taxonomy";
import { JobMatchFacts } from "./match-brief.types";

export function computeJobMatchVersion(job: JobMatchFacts): string {
  const payload = {
    taxonomyVersion: MATCH_BRIEF_TAXONOMY_VERSION,
    title: job.title,
    seniority: job.seniority,
    employmentType: job.employmentType,
    workMode: job.workMode,
    salary: job.salary
      ? {
          min: job.salary.min,
          max: job.salary.max,
          currency: job.salary.currency,
          period: job.salary.period
        }
      : null
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
}

