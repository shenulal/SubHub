// src/lib/services/subscription/similarity.ts
/**
 * Pure string-similarity helpers used for duplicate detection.
 * No I/O, no settings access — callers supply thresholds.
 */

const LEGAL_SUFFIXES = new Set([
  "inc",
  "llc",
  "ltd",
  "limited",
  "corp",
  "corporation",
  "co",
  "gmbh",
  "sa",
  "plc",
  "pty",
  "the",
]);

/** Lower-case, strip accents/punctuation, drop legal suffixes, collapse whitespace. */
export function normalizeName(input: string): string {
  const stripped = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ");
  const tokens = stripped
    .split(/\s+/)
    .filter((token) => token.length > 0 && !LEGAL_SUFFIXES.has(token));
  return tokens.join(" ");
}

/** Normalise a domain: strip protocol, `www.`, path and port. */
export function normalizeDomain(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#:]/)[0];
}

function bigrams(value: string): Map<string, number> {
  const map = new Map<string, number>();
  const compact = value.replace(/\s+/g, "");
  for (let i = 0; i < compact.length - 1; i++) {
    const gram = compact.slice(i, i + 2);
    map.set(gram, (map.get(gram) ?? 0) + 1);
  }
  return map;
}

/** Sørensen–Dice coefficient over character bigrams (0..1). */
export function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const aGrams = bigrams(a);
  const bGrams = bigrams(b);
  let overlap = 0;
  for (const [gram, count] of aGrams) {
    const other = bGrams.get(gram);
    if (other) overlap += Math.min(count, other);
  }
  const total =
    [...aGrams.values()].reduce((s, n) => s + n, 0) +
    [...bGrams.values()].reduce((s, n) => s + n, 0);
  return total === 0 ? 0 : (2 * overlap) / total;
}

function jaro(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const window = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatched = new Array<boolean>(a.length).fill(false);
  const bMatched = new Array<boolean>(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - window);
    const end = Math.min(i + window + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bMatched[j] || a[i] !== b[j]) continue;
      aMatched[i] = true;
      bMatched[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;
  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatched[i]) continue;
    while (!bMatched[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  const t = transpositions / 2;
  return (
    (matches / a.length + matches / b.length + (matches - t) / matches) / 3
  );
}

const JARO_WINKLER_SCALING = 0.1;
const JARO_WINKLER_MAX_PREFIX = 4;

/** Jaro–Winkler similarity (0..1) with the standard prefix bonus. */
export function jaroWinkler(a: string, b: string): number {
  const base = jaro(a, b);
  let prefix = 0;
  const limit = Math.min(JARO_WINKLER_MAX_PREFIX, a.length, b.length);
  while (prefix < limit && a[prefix] === b[prefix]) prefix++;
  return base + prefix * JARO_WINKLER_SCALING * (1 - base);
}

/**
 * Combined name similarity: normalise both names, then take the stronger of
 * Dice (robust to token reorder) and Jaro–Winkler (robust to typos).
 */
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  return Math.max(diceCoefficient(na, nb), jaroWinkler(na, nb));
}
