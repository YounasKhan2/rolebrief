import assert from "node:assert/strict";
import { test } from "node:test";
import type { MatchBriefSummary } from "../../lib/match-briefs";
import {
  displayDate,
  eligibilityTone,
  evidenceItems,
} from "./radar-presentation";

test("Radar evidence shows only supplied facts, preserves reasoning order and stays bounded", () => {
  assert.deepEqual(evidenceItems(), []);
  const summary = {
    strengths: [{ label: "Role title aligns" }],
    gaps: [{ label: "Working preference differs" }],
    unknowns: [{ label: "Salary unknown" }, { label: "Seniority unknown" }],
  } as MatchBriefSummary;
  assert.deepEqual(evidenceItems(summary), [
    { label: "Role title aligns", kind: "strength" },
    { label: "Working preference differs", kind: "gap" },
    { label: "Salary unknown", kind: "unknown" },
  ]);
});
test("Eligibility conflict remains a separate visible status", () => {
  assert.equal(eligibilityTone("CONFLICT"), "tone-conflict");
  assert.equal(eligibilityTone("CHECK_REQUIRED"), "tone-check");
  assert.equal(eligibilityTone("APPEARS_ELIGIBLE"), "tone-good");
  assert.equal(eligibilityTone("LIKELY_ELIGIBLE"), "tone-good");
  assert.equal(eligibilityTone("NOT_CALCULATED"), "tone-unknown");
});
test("Radar dates respect the selected timezone and handle missing or invalid dates", () => {
  assert.equal(displayDate("not-a-date"), "Date unavailable");
  assert.notEqual(
    displayDate("2026-09-11T01:00:00Z", "America/Los_Angeles"),
    displayDate("2026-09-11T01:00:00Z", "UTC"),
  );
  assert.equal(
    displayDate("2026-09-11T01:00:00Z", "invalid-zone"),
    displayDate("2026-09-11T01:00:00Z", "UTC"),
  );
});
