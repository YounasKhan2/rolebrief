import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { ReasonCode } from "./reason-codes";
import { TimezoneResolverService } from "./timezone-resolver.service";

describe("TimezoneResolverService", () => {
  let service: TimezoneResolverService;

  beforeEach(() => {
    service = new TimezoneResolverService();
  });

  describe("getOffsetMinutes", () => {
    it("calculates exact offset for non-DST fixed offset zones", () => {
      assert.equal(service.getOffsetMinutes("Asia/Karachi"), 300);
      assert.equal(service.getOffsetMinutes("Asia/Kolkata"), 330);
      assert.equal(service.getOffsetMinutes("Asia/Kathmandu"), 345);
      assert.equal(service.getOffsetMinutes("UTC"), 0);
    });

    it("returns null for invalid timezone string", () => {
      assert.equal(service.getOffsetMinutes("Invalid/Timezone"), null);
      assert.equal(service.getOffsetMinutes(""), null);
    });
  });

  describe("getSeasonalOffsets", () => {
    it("returns distinct summer and winter offsets for DST-observing zones", () => {
      const offsets = service.getSeasonalOffsets("America/New_York");
      assert.equal(offsets.includes(-300), true); // Winter (EST, UTC-5)
      assert.equal(offsets.includes(-240), true); // Summer (EDT, UTC-4)
    });

    it("returns single offset for zones without DST", () => {
      const offsets = service.getSeasonalOffsets("Asia/Karachi");
      assert.deepEqual(offsets, [300]);
    });
  });

  describe("formatOffset", () => {
    it("formats positive and negative offsets cleanly", () => {
      assert.equal(service.formatOffset(300), "UTC+05:00");
      assert.equal(service.formatOffset(330), "UTC+05:30");
      assert.equal(service.formatOffset(-300), "UTC-05:00");
      assert.equal(service.formatOffset(0), "UTC+00:00");
    });
  });

  describe("evaluate", () => {
    it("evaluates SATISFIED when job has no declared timezone restrictions", () => {
      const res = service.evaluate("Asia/Karachi", []);
      assert.equal(res.status, "SATISFIED");
      assert.equal(res.reasonCode, ReasonCode.TZ_NO_DECLARED_RESTRICTION);
    });

    it("evaluates INSUFFICIENT_DATA when candidate has unspecified timezone", () => {
      const res = service.evaluate(null, [-300, -360]);
      assert.equal(res.status, "INSUFFICIENT_DATA");
      assert.equal(res.reasonCode, ReasonCode.TZ_CANDIDATE_UNSPECIFIED);
    });

    it("evaluates SATISFIED when candidate offset matches job declared band", () => {
      const res = service.evaluate("Asia/Karachi", [180, 240, 300, 360]);
      assert.equal(res.status, "SATISFIED");
      assert.equal(res.reasonCode, ReasonCode.TZ_WITHIN_DECLARED_OFFSET);
    });

    it("evaluates SATISFIED when candidate seasonal DST offset matches job declared band", () => {
      // America/New_York observes -300 and -240. If job accepts -300 only:
      const res = service.evaluate("America/New_York", [-300]);
      assert.equal(res.status, "SATISFIED");
      assert.equal(res.reasonCode, ReasonCode.TZ_WITHIN_DECLARED_OFFSET);
    });

    it("evaluates INSUFFICIENT_DATA (never CONFLICT) when candidate offset is outside band", () => {
      const res = service.evaluate("Asia/Karachi", [-300, -360, -420]); // UTC+5 vs US offsets
      assert.equal(res.status, "INSUFFICIENT_DATA");
      assert.equal(res.reasonCode, ReasonCode.TZ_OUTSIDE_DECLARED_OFFSET);
      assert.notEqual(res.status, "CONFLICT");
    });

    it("verifies exact discrete set membership: non-listed offset between min and max is rejected", () => {
      // Declared: UTC-05:00 (-300) and UTC-03:00 (-180). Notice UTC-04:00 (-240) is in range [-300, -180] but NOT in discrete set!
      // Using America/Santiago or fixed date for -240 (UTC-4):
      const res = service.evaluate("America/Porto_Velho", [-300, -180]); // Porto Velho is UTC-4 (-240) all year
      assert.equal(res.status, "INSUFFICIENT_DATA");
      assert.equal(res.reasonCode, ReasonCode.TZ_OUTSIDE_DECLARED_OFFSET);
    });
  });
});
