export const MATCH_BRIEF_ENGINE_VERSION = "match-brief-v1";
export const MATCH_BRIEF_TAXONOMY_VERSION = "title-taxonomy-v1";

const TOKEN_ALIASES = new Map<string, string>([
  ["front-end", "frontend"],
  ["front end", "frontend"],
  ["back-end", "backend"],
  ["back end", "backend"],
  ["full-stack", "fullstack"],
  ["full stack", "fullstack"],
  ["nodejs", "node.js"],
  ["node js", "node.js"]
]);

export function normalizeTitleForMatch(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[^\p{L}\p{N}.+#-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((token) => TOKEN_ALIASES.get(token) ?? token)
    .join(" ")
    .replace(/\bfront end\b/g, "frontend")
    .replace(/\bback end\b/g, "backend")
    .replace(/\bfull stack\b/g, "fullstack")
    .replace(/\bnode js\b/g, "node.js")
    .replace(/\s+/g, " ")
    .trim();
}

export function titleTokens(value: string): string[] {
  return normalizeTitleForMatch(value).split(" ").filter(Boolean);
}

export function hasConservativePartialTitleMatch(candidate: string, job: string): boolean {
  const candidateTokens = titleTokens(candidate);
  const jobTokens = titleTokens(job);
  if (candidateTokens.length < 2 || jobTokens.length < 2) return false;

  const candidateSet = new Set(candidateTokens);
  const jobSet = new Set(jobTokens);
  const overlap = candidateTokens.filter((token) => jobSet.has(token));
  const protectedPairs = [
    ["java", "javascript"],
    ["manager", "designer"],
    ["engineer", "analyst"],
    ["frontend", "fullstack"],
    ["backend", "fullstack"]
  ];

  for (const [left, right] of protectedPairs) {
    if ((candidateSet.has(left) && jobSet.has(right)) || (candidateSet.has(right) && jobSet.has(left))) {
      return false;
    }
  }

  return overlap.length >= 2 && overlap.length === Math.min(candidateTokens.length, jobTokens.length);
}

