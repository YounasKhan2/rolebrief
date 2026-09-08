/**
 * Provider-specific and historical country aliases layered over canonical ISO-3166-1 registry.
 */

export interface CountryAliasRecord {
  alpha2: string;
  canonicalName: string;
}

// Normalized lowercase alias map -> { alpha2, canonicalName }
export const PROVIDER_COUNTRY_ALIASES: Record<string, CountryAliasRecord> = {
  // Inverted names used by Himalayas
  "congo, the democratic republic of the": { alpha2: "CD", canonicalName: "Democratic Republic of the Congo" },
  "the democratic republic of the congo": { alpha2: "CD", canonicalName: "Democratic Republic of the Congo" },
  "congo, democratic republic of the": { alpha2: "CD", canonicalName: "Democratic Republic of the Congo" },
  "dr congo": { alpha2: "CD", canonicalName: "Democratic Republic of the Congo" },
  "drc": { alpha2: "CD", canonicalName: "Democratic Republic of the Congo" },
  "congo, republic of the": { alpha2: "CG", canonicalName: "Congo" },

  // Formal designations
  "holy see (vatican city state)": { alpha2: "VA", canonicalName: "Holy See" },
  "lao people's democratic republic": { alpha2: "LA", canonicalName: "Laos" },
  "palestine, state of": { alpha2: "PS", canonicalName: "Palestine" },
  "state of palestine": { alpha2: "PS", canonicalName: "Palestine" },
  "syrian arab republic": { alpha2: "SY", canonicalName: "Syria" },
  "taiwan, province of china": { alpha2: "TW", canonicalName: "Taiwan" },
  "tanzania, united republic of": { alpha2: "TZ", canonicalName: "Tanzania" },
  "venezuela, bolivarian republic of": { alpha2: "VE", canonicalName: "Venezuela" },
  "bolivia, plurinational state of": { alpha2: "BO", canonicalName: "Bolivia" },
  "iran, islamic republic of": { alpha2: "IR", canonicalName: "Iran" },
  "micronesia, federated states of": { alpha2: "FM", canonicalName: "Micronesia" },
  "moldova, republic of": { alpha2: "MD", canonicalName: "Moldova" },

  // Territories and Overseas Collectivities
  "saint martin (french part)": { alpha2: "MF", canonicalName: "Saint Martin" },
  "sint maarten (dutch part)": { alpha2: "SX", canonicalName: "Sint Maarten" },
  "saint helena, ascension and tristan da cunha": { alpha2: "SH", canonicalName: "Saint Helena" },
  "virgin islands, british": { alpha2: "VG", canonicalName: "Virgin Islands (British)" },
  "virgin islands, u.s.": { alpha2: "VI", canonicalName: "Virgin Islands (U.S.)" },
  "british virgin islands": { alpha2: "VG", canonicalName: "Virgin Islands (British)" },
  "bvi": { alpha2: "VG", canonicalName: "Virgin Islands (British)" },
  "us virgin islands": { alpha2: "VI", canonicalName: "Virgin Islands (U.S.)" },
  "u.s. virgin islands": { alpha2: "VI", canonicalName: "Virgin Islands (U.S.)" },

  // Common country abbreviations and aliases
  "usa": { alpha2: "US", canonicalName: "United States" },
  "u.s.a.": { alpha2: "US", canonicalName: "United States" },
  "u.s.": { alpha2: "US", canonicalName: "United States" },
  "uk": { alpha2: "GB", canonicalName: "United Kingdom" },
  "u.k.": { alpha2: "GB", canonicalName: "United Kingdom" },
  "great britain": { alpha2: "GB", canonicalName: "United Kingdom" },
  "england": { alpha2: "GB", canonicalName: "United Kingdom" },
  "scotland": { alpha2: "GB", canonicalName: "United Kingdom" },
  "wales": { alpha2: "GB", canonicalName: "United Kingdom" },
  "northern ireland": { alpha2: "GB", canonicalName: "United Kingdom" },
  "uae": { alpha2: "AE", canonicalName: "United Arab Emirates" },
  "u.a.e.": { alpha2: "AE", canonicalName: "United Arab Emirates" }
};
