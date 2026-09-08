import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { CountryResolverService } from "./country-resolver.service";

describe("CountryResolverService", () => {
  let resolver: CountryResolverService;

  beforeEach(() => {
    resolver = new CountryResolverService();
  });

  describe("resolve - ISO Alpha-2 Direct Matching", () => {
    it("resolves valid uppercase alpha-2 codes", () => {
      const res = resolver.resolve("US");
      assert.equal(res.status, "RESOLVED");
      assert.equal(res.alpha2, "US");
      assert.equal(res.canonicalLabel, "United States");
    });

    it("resolves valid lowercase alpha-2 codes after normalization", () => {
      const res = resolver.resolve("ca");
      assert.equal(res.status, "RESOLVED");
      assert.equal(res.alpha2, "CA");
      assert.equal(res.canonicalLabel, "Canada");
    });

    it("resolves user-assigned Kosovo code XK", () => {
      const res = resolver.resolve("XK");
      assert.equal(res.status, "RESOLVED");
      assert.equal(res.alpha2, "XK");
      assert.equal(res.canonicalLabel, "Kosovo");
    });

    it("rejects non-allowlist 2-letter codes", () => {
      const res1 = resolver.resolve("ZZ");
      assert.equal(res1.status, "UNRESOLVED");
      assert.equal(res1.alpha2, null);

      const res2 = resolver.resolve("99");
      assert.equal(res2.status, "UNRESOLVED");
      assert.equal(res2.alpha2, null);
    });
  });

  describe("resolve - Canonical Country Names", () => {
    it("resolves standard canonical names case-insensitively", () => {
      assert.equal(resolver.resolve("United States").alpha2, "US");
      assert.equal(resolver.resolve("united states").alpha2, "US");
      assert.equal(resolver.resolve("UNITED KINGDOM").alpha2, "GB");
      assert.equal(resolver.resolve("Germany").alpha2, "DE");
      assert.equal(resolver.resolve("Pakistan").alpha2, "PK");
      assert.equal(resolver.resolve("Australia").alpha2, "AU");
    });

    it("resolves Czechia", () => {
      const res = resolver.resolve("Czechia");
      assert.equal(res.status, "RESOLVED");
      assert.equal(res.alpha2, "CZ");
    });

    it("resolves accented names with NFKC decomposition", () => {
      const res = resolver.resolve("Côte d'Ivoire");
      assert.equal(res.status, "RESOLVED");
      assert.equal(res.alpha2, "CI");
    });

    it("resolves Åland Islands", () => {
      const res = resolver.resolve("Åland Islands");
      assert.equal(res.status, "RESOLVED");
      assert.equal(res.alpha2, "AX");
    });

    it("resolves Hong Kong and Taiwan", () => {
      assert.equal(resolver.resolve("Hong Kong").alpha2, "HK");
      assert.equal(resolver.resolve("Taiwan").alpha2, "TW");
    });

    it("resolves Kosovo by name", () => {
      const res = resolver.resolve("Kosovo");
      assert.equal(res.status, "RESOLVED");
      assert.equal(res.alpha2, "XK");
    });
  });

  describe("resolve - Provider and Historical Aliases", () => {
    it("resolves inverted Democratic Republic of the Congo syntax from Himalayas", () => {
      const res = resolver.resolve("Congo, The Democratic Republic of the");
      assert.equal(res.status, "ALIAS_RESOLVED");
      assert.equal(res.alpha2, "CD");
      assert.equal(res.canonicalLabel, "Democratic Republic of the Congo");
    });

    it("distinguishes Congo (CG) from DR Congo (CD)", () => {
      assert.equal(resolver.resolve("Congo").alpha2, "CG");
      assert.equal(resolver.resolve("DR Congo").alpha2, "CD");
    });

    it("resolves South Korea alias", () => {
      const res = resolver.resolve("South Korea");
      assert.equal(res.alpha2, "KR");
      assert.equal(res.status, "RESOLVED");
    });

    it("resolves Turkey and Türkiye", () => {
      assert.equal(resolver.resolve("Turkey").alpha2, "TR");
      assert.equal(resolver.resolve("Türkiye").alpha2, "TR");
    });

    it("resolves Holy See (Vatican City State)", () => {
      const res = resolver.resolve("Holy See (Vatican City State)");
      assert.equal(res.alpha2, "VA");
      assert.equal(res.status, "ALIAS_RESOLVED");
    });

    it("resolves common abbreviations (USA, UK, UAE)", () => {
      assert.equal(resolver.resolve("USA").alpha2, "US");
      assert.equal(resolver.resolve("UK").alpha2, "GB");
      assert.equal(resolver.resolve("UAE").alpha2, "AE");
    });
  });

  describe("resolve - Normalization and Preservation", () => {
    it("trims and collapses excessive whitespace", () => {
      const res = resolver.resolve("   United     States   ");
      assert.equal(res.normalizedLabel, "United States");
      assert.equal(res.alpha2, "US");
      assert.equal(res.status, "RESOLVED");
    });

    it("preserves unresolvable strings without dropping them", () => {
      const res = resolver.resolve("Atlantis City");
      assert.equal(res.status, "UNRESOLVED");
      assert.equal(res.alpha2, null);
      assert.equal(res.rawLabel, "Atlantis City");
      assert.equal(res.normalizedLabel, "Atlantis City");
    });

    it("handles empty or whitespace-only input safely", () => {
      const res = resolver.resolve("   ");
      assert.equal(res.status, "UNRESOLVED");
      assert.equal(res.alpha2, null);
      assert.equal(res.normalizedLabel, "");
    });
  });

  describe("resolveMany", () => {
    it("resolves and deduplicates mixed valid and invalid strings", () => {
      const result = resolver.resolveMany([
        "United States",
        "US",
        "Canada",
        "canada",
        "Atlantis",
        "Congo, The Democratic Republic of the",
        "   "
      ]);

      assert.deepEqual(result.resolvedCountryCodes, ["CA", "CD", "US"]);
      assert.deepEqual(result.resolvedLabels, ["Canada", "Democratic Republic of the Congo", "United States"]);
      assert.deepEqual(result.unresolvedLabels, ["Atlantis"]);
      assert.equal(result.details.length, 7);
    });
  });
});
