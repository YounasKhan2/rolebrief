import assert from "node:assert/strict";
import { test } from "node:test";
import { himalayasResponseSchema } from "./himalayas.dto";
import { sampleHimalayasResponse } from "./himalayas.test-fixtures";

test("validates Himalayas response DTOs", () => {
  const parsed = himalayasResponseSchema.parse(sampleHimalayasResponse({ nextCursor: "next" }));

  assert.equal(parsed.jobs[0].guid, "guid-1");
  assert.deepEqual(parsed.jobs[0].seniority, ["Senior"]);
  assert.equal(parsed.jobs[0].salaryPeriod, "annual");
  const firstRestriction = parsed.jobs[0].locationRestrictions[0];
  assert.equal(typeof firstRestriction === "object" ? firstRestriction.name : firstRestriction, "United States");
});

test("rejects incomplete Himalayas job records", () => {
  assert.throws(() =>
    himalayasResponseSchema.parse({
      jobs: [{ title: "Missing company and guid", applicationLink: "not-a-url" }]
    })
  );
});
