import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeHimalayasJob } from "./himalayas.normalizer";
import { sampleHimalayasJob } from "./himalayas.test-fixtures";

test("normalizes restriction objects and timestamp variants without flattening HTML", () => {
  const normalized = normalizeHimalayasJob(
    sampleHimalayasJob({
      description: "<h3>Overview</h3><p>Hello <em>candidate</em></p><script>alert(1)</script>",
      pubDate: 1_788_548_400_000,
      expiryDate: 1_793_736_000,
      locationRestrictions: [{ alpha2: "CA", name: "Canada", slug: "canada" }],
      timezoneRestrictions: ["-8", "-7"],
      minSalary: 100000,
      maxSalary: null,
      salaryPeriod: "annual"
    })
  );

  assert.equal(normalized.descriptionHtml?.includes("<h3>Overview</h3>"), true);
  assert.equal(normalized.descriptionHtml?.includes("<script>alert(1)</script>"), true);
  assert.equal(normalized.descriptionText?.includes("<script>"), false);
  assert.equal(normalized.remote.countries[0].name, "Canada");
  assert.equal(normalized.remote.scope, "COUNTRY_AND_TIMEZONE_LIMITED");
  assert.deepEqual(normalized.remote.timezones, ["-8", "-7"]);
  assert.equal(normalized.sourcePublishedAt?.toISOString(), "2026-09-04T19:00:00.000Z");
  assert.equal(normalized.providerExpiresAt?.toISOString(), "2026-11-03T20:00:00.000Z");
  assert.equal(normalized.salary?.min, 100000);
  assert.equal(normalized.salary?.period, "annual");
});

test("uses provider guid for stable slug identity", () => {
  const first = normalizeHimalayasJob(sampleHimalayasJob({ title: "Senior Engineer", guid: "same-guid" }));
  const second = normalizeHimalayasJob(sampleHimalayasJob({ title: "Staff Engineer", guid: "same-guid" }));

  assert.equal(first.externalId, "same-guid");
  assert.equal(first.slug, second.slug);
});
