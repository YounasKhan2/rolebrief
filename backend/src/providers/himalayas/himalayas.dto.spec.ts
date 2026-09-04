import assert from "node:assert/strict";
import { test } from "node:test";
import { himalayasResponseSchema } from "./himalayas.dto";

test("validates Himalayas response DTOs", () => {
  const parsed = himalayasResponseSchema.parse({
    updatedAt: Date.now(),
    nextCursor: "next",
    jobs: [
      {
        title: "Senior Engineer",
        companyName: "Acme",
        companySlug: "acme",
        employmentType: "Full Time",
        locationRestrictions: [],
        timezoneRestrictions: [],
        categories: ["Engineering"],
        parentCategories: ["Software"],
        description: "<p>Hello</p>",
        pubDate: Date.now(),
        expiryDate: Date.now() + 1000,
        applicationLink: "https://himalayas.app/jobs/acme-senior-engineer",
        guid: "guid-1"
      }
    ]
  });

  assert.equal(parsed.jobs[0].guid, "guid-1");
});

test("rejects incomplete Himalayas job records", () => {
  assert.throws(() =>
    himalayasResponseSchema.parse({
      jobs: [{ title: "Missing company and guid", applicationLink: "not-a-url" }]
    })
  );
});
