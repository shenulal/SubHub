// src/lib/services/receipts/parser.amount.ts
/**
 * Amount + currency extraction. Pure and deterministic.
 */
import {
  CURRENCY_CODES,
  CURRENCY_SYMBOLS,
  TOTAL_LINE_LABELS,
} from "./parser.constants";

export interface MoneyToken {
  amount: number;
  currency: string;
  /** Character offset in the source text */
  index: number;
}

const SYMBOLS = Object.keys(CURRENCY_SYMBOLS)
  // longest first so "US$" wins over "$"
  .sort((a, b) => b.length - a.length)
  .map(escapeRegex)
  .join("|");
const CODES = CURRENCY_CODES.join("|");
const NUMBER = String.raw`\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?`;

const PREFIXED = new RegExp(
  String.raw`(${SYMBOLS}|\b(?:${CODES})\b)\s?(${NUMBER})(?![\d%])`,
  "gi"
);
const SUFFIXED = new RegExp(
  String.raw`(?<![\d.,])(${NUMBER})\s?(${SYMBOLS}|\b(?:${CODES})\b)(?![\w%])`,
  "gi"
);

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Normalise "1.299,00" / "1,299.00" / "9,99" / "12.99" / "1 299,50" to a number.
 */
export function parseLocalisedNumber(raw: string): number | null {
  const compact = raw.replace(/\s/g, "");
  const lastComma = compact.lastIndexOf(",");
  const lastDot = compact.lastIndexOf(".");
  let normalised: string;

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSep = lastComma > lastDot ? "," : ".";
    const thousandsSep = decimalSep === "," ? "." : ",";
    normalised = compact.split(thousandsSep).join("").replace(decimalSep, ".");
  } else if (lastComma >= 0) {
    const tail = compact.length - lastComma - 1;
    normalised =
      tail === 3 && compact.indexOf(",") === lastComma
        ? compact.replace(",", "")
        : compact.split(",").length > 2
          ? compact.split(",").join("")
          : compact.replace(",", ".");
  } else if (lastDot >= 0) {
    const tail = compact.length - lastDot - 1;
    normalised =
      tail === 3 && compact.indexOf(".") === lastDot
        ? compact.replace(".", "")
        : compact.split(".").length > 2
          ? compact.split(".").join("")
          : compact;
  } else {
    normalised = compact;
  }

  const value = Number(normalised);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100) / 100;
}

function resolveCurrency(token: string, text: string): string {
  const upper = token.toUpperCase();
  if ((CURRENCY_CODES as readonly string[]).includes(upper)) return upper;
  const mapped = CURRENCY_SYMBOLS[token] ?? CURRENCY_SYMBOLS[upper];
  if (mapped !== "USD" || token !== "$") return mapped ?? "USD";
  // Bare `$`: honour an explicit dollar variant mentioned elsewhere in the text.
  const explicit = /\b(AUD|CAD|SGD|NZD|HKD)\b/i.exec(text);
  return explicit ? explicit[1].toUpperCase() : "USD";
}

/**
 * Every money token in the text, in document order.
 */
export function extractMoneyTokens(text: string): MoneyToken[] {
  const tokens: MoneyToken[] = [];
  const seen = new Set<number>();

  const push = (
    numberRaw: string,
    currencyRaw: string,
    index: number
  ): void => {
    if (seen.has(index)) return;
    const amount = parseLocalisedNumber(numberRaw);
    if (amount === null || amount === 0) return;
    seen.add(index);
    tokens.push({
      amount,
      currency: resolveCurrency(currencyRaw, text),
      index,
    });
  };

  for (const match of text.matchAll(PREFIXED)) {
    push(match[2], match[1], match.index ?? 0);
  }
  for (const match of text.matchAll(SUFFIXED)) {
    push(match[1], match[2], match.index ?? 0);
  }
  return tokens.sort((a, b) => a.index - b.index);
}

/**
 * The amount on a "Total" / "Amount charged" line wins; otherwise the largest
 * amount in the message (line items sum to the total on a receipt).
 */
export function extractAmount(
  text: string
): { amount: number; currency: string } | null {
  const tokens = extractMoneyTokens(text);
  if (tokens.length === 0) return null;

  const lines = text.split(/\r?\n/);
  let offset = 0;
  const lineStarts = lines.map((line) => {
    const start = offset;
    offset += line.length + 1;
    return start;
  });

  for (const label of TOTAL_LINE_LABELS) {
    const labelRe = new RegExp(String.raw`\b${label}\b`, "i");
    for (let i = 0; i < lines.length; i++) {
      if (!labelRe.test(lines[i])) continue;
      const start = lineStarts[i];
      const end = start + lines[i].length;
      // Allow the amount to sit on the same line or the next (table layouts).
      const nextEnd =
        i + 1 < lines.length ? lineStarts[i + 1] + lines[i + 1].length : end;
      const onLine = tokens.filter((t) => t.index >= start && t.index <= end);
      const candidates =
        onLine.length > 0
          ? onLine
          : tokens.filter((t) => t.index > end && t.index <= nextEnd);
      if (candidates.length > 0) {
        const best = candidates[candidates.length - 1];
        return { amount: best.amount, currency: best.currency };
      }
    }
  }

  const largest = tokens.reduce((a, b) => (b.amount > a.amount ? b : a));
  return { amount: largest.amount, currency: largest.currency };
}
