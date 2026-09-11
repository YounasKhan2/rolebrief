import type { MatchBriefSummary } from "../../lib/match-briefs";
import type { OverallEligibilityStatus } from "../../lib/eligibility";

export function evidenceItems(summary?: MatchBriefSummary) {
  if (!summary) return [];
  return [
    ...summary.strengths.map((item) => ({
      label: item.label,
      kind: "strength",
    })),
    ...summary.gaps.map((item) => ({ label: item.label, kind: "gap" })),
    ...summary.unknowns.map((item) => ({ label: item.label, kind: "unknown" })),
  ].slice(0, 3);
}
export function eligibilityTone(status?: OverallEligibilityStatus) {
  if (status === "CONFLICT") return "tone-conflict";
  if (status === "CHECK_REQUIRED") return "tone-check";
  if (status === "APPEARS_ELIGIBLE" || status === "LIKELY_ELIGIBLE")
    return "tone-good";
  return "tone-unknown";
}
export function displayDate(value: string, timezone?: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Date unavailable";
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      timeZone: timezone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(date);
  }
}
