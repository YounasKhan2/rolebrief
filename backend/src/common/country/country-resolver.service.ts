import { Injectable } from "@nestjs/common";
import {
  CANONICAL_ALPHA2_SET,
  CANONICAL_COUNTRIES,
  CanonicalCountryRecord
} from "./iso-3166-1-registry";
import { PROVIDER_COUNTRY_ALIASES } from "./provider-country-aliases";

export type CountryResolutionStatus = "RESOLVED" | "ALIAS_RESOLVED" | "UNRESOLVED";

export interface CountryResolution {
  readonly rawLabel: string;
  readonly normalizedLabel: string;
  readonly canonicalLabel: string | null;
  readonly alpha2: string | null;
  readonly status: CountryResolutionStatus;
}

export interface BatchCountryResolution {
  readonly resolvedCountryCodes: string[];
  readonly resolvedLabels: string[];
  readonly unresolvedLabels: string[];
  readonly details: CountryResolution[];
}

@Injectable()
export class CountryResolverService {
  /**
   * Pre-processes raw input string:
   * - Unicode NFKC normalization (decomposing compatibility characters)
   * - Trim leading and trailing whitespace
   * - Collapse multiple internal whitespace characters into single space
   */
  normalizeInput(raw: string): string {
    return raw.normalize("NFKC").trim().replace(/\s+/g, " ");
  }

  /**
   * Resolves a single country or territory label to its canonical ISO alpha-2 code.
   */
  resolve(rawLabel: string): CountryResolution {
    const normalized = this.normalizeInput(rawLabel);

    if (!normalized) {
      return {
        rawLabel,
        normalizedLabel: normalized,
        canonicalLabel: null,
        alpha2: null,
        status: "UNRESOLVED"
      };
    }

    // Check if input is a 2-character ISO code
    if (normalized.length === 2) {
      const upper = normalized.toUpperCase();
      if (CANONICAL_ALPHA2_SET.has(upper)) {
        const match = Object.values(CANONICAL_COUNTRIES).find((c) => c.alpha2 === upper);
        return {
          rawLabel,
          normalizedLabel: normalized,
          canonicalLabel: match?.name ?? upper,
          alpha2: upper,
          status: "RESOLVED"
        };
      }
      const lower = normalized.toLowerCase();
      const aliasMatch = PROVIDER_COUNTRY_ALIASES[lower];
      if (aliasMatch) {
        return {
          rawLabel,
          normalizedLabel: normalized,
          canonicalLabel: aliasMatch.canonicalName,
          alpha2: aliasMatch.alpha2,
          status: "ALIAS_RESOLVED"
        };
      }
      // Two-character string that is NOT in the allowlist and not a known alias is UNRESOLVED
      return {
        rawLabel,
        normalizedLabel: normalized,
        canonicalLabel: null,
        alpha2: null,
        status: "UNRESOLVED"
      };
    }

    const lower = normalized.toLowerCase();

    // Check canonical registry
    const canonicalMatch: CanonicalCountryRecord | undefined = CANONICAL_COUNTRIES[lower];
    if (canonicalMatch) {
      return {
        rawLabel,
        normalizedLabel: normalized,
        canonicalLabel: canonicalMatch.name,
        alpha2: canonicalMatch.alpha2,
        status: "RESOLVED"
      };
    }

    // Check provider / historical aliases
    const aliasMatch = PROVIDER_COUNTRY_ALIASES[lower];
    if (aliasMatch) {
      return {
        rawLabel,
        normalizedLabel: normalized,
        canonicalLabel: aliasMatch.canonicalName,
        alpha2: aliasMatch.alpha2,
        status: "ALIAS_RESOLVED"
      };
    }

    // Unresolved fallback: preserve original string, never discard
    return {
      rawLabel,
      normalizedLabel: normalized,
      canonicalLabel: null,
      alpha2: null,
      status: "UNRESOLVED"
    };
  }

  /**
   * Resolves an array of raw country labels into deduplicated canonical ISO alpha-2 codes,
   * canonical display labels, and preserved unresolved labels.
   */
  resolveMany(rawLabels: readonly string[]): BatchCountryResolution {
    const details: CountryResolution[] = [];
    const codeSet = new Set<string>();
    const labelSet = new Set<string>();
    const unresolvedSet = new Set<string>();

    for (const raw of rawLabels) {
      const res = this.resolve(raw);
      details.push(res);

      if (res.alpha2) {
        codeSet.add(res.alpha2);
        if (res.canonicalLabel) {
          labelSet.add(res.canonicalLabel);
        }
      } else if (res.normalizedLabel) {
        unresolvedSet.add(res.normalizedLabel);
      }
    }

    return {
      resolvedCountryCodes: Array.from(codeSet).sort(),
      resolvedLabels: Array.from(labelSet).sort(),
      unresolvedLabels: Array.from(unresolvedSet).sort(),
      details
    };
  }
}
