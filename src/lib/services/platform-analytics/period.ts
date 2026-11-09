// src/lib/services/platform-analytics/period.ts
/**
 * Control Panel analytics periods (pure, client-safe). Tokens come from the
 * settings registry (`system.analyticsPeriods`, `system.analyticsDefaultPeriod`):
 * a number followed by `d` (days) or `m` (calendar months, current month included).
 * Month buckets are UTC "YYYY-MM" keys, matching `date_trunc('month', …)` in SQL.
 */
import { ANALYTICS_PERIOD, SETTING_DEFINITIONS } from "@/lib/settings/registry";
import type {
  AnalyticsPeriodInfo,
  PeriodOption,
} from "@/types/platform-analytics";

const MS_PER_DAY = 86_400_000;
const REGISTRY_DEFAULT_PERIOD: string =
  SETTING_DEFINITIONS["system.analyticsDefaultPeriod"].defaultValue;

export interface ParsedPeriod {
  amount: number;
  unit: "d" | "m";
}

export function parsePeriodToken(token: string | null | undefined) {
  if (!token || !ANALYTICS_PERIOD.test(token)) return null;
  return {
    amount: Number(token.slice(0, -1)),
    unit: token.slice(-1) as ParsedPeriod["unit"],
  } satisfies ParsedPeriod;
}

export function periodLabel(token: string): string {
  const parsed = parsePeriodToken(token);
  if (!parsed) return token;
  const noun = parsed.unit === "d" ? "day" : "month";
  return `Last ${parsed.amount} ${noun}${parsed.amount === 1 ? "" : "s"}`;
}

/** Valid, de-duplicated period tokens in their configured order. */
export function periodOptions(tokens: readonly string[]): PeriodOption[] {
  const seen = new Set<string>();
  const out: PeriodOption[] = [];
  for (const token of tokens) {
    if (!parsePeriodToken(token) || seen.has(token)) continue;
    seen.add(token);
    out.push({ token, label: periodLabel(token) });
  }
  return out;
}

function startOfUtcMonth(date: Date, monthsBack = 0): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - monthsBack, 1)
  );
}

export function periodStart(parsed: ParsedPeriod, now: Date): Date {
  return parsed.unit === "d"
    ? new Date(now.getTime() - parsed.amount * MS_PER_DAY)
    : startOfUtcMonth(now, parsed.amount - 1);
}

export function monthKey(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}`;
}

/** Every "YYYY-MM" from the month of `since` to the month of `until`. */
export function monthKeys(since: Date, until: Date): string[] {
  const keys: string[] = [];
  const last = monthKey(until);
  for (let i = 0; ; i += 1) {
    const key = monthKey(
      new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth() + i, 1))
    );
    keys.push(key);
    if (key >= last) return keys;
  }
}

export interface ResolvePeriodInput {
  requested?: string | null;
  allowed: readonly string[];
  fallback: string;
  now?: Date;
}

/**
 * Pick the requested period when it is one of the allowed tokens, else the
 * configured default (when allowed), else the first allowed token.
 */
export function resolvePeriod({
  requested,
  allowed,
  fallback,
  now = new Date(),
}: ResolvePeriodInput): AnalyticsPeriodInfo {
  const options = periodOptions(allowed);
  const tokens = options.map((o) => o.token);
  const token =
    (requested && tokens.includes(requested) && requested) ||
    (tokens.includes(fallback) ? fallback : (tokens[0] ?? fallback));
  const parsed =
    parsePeriodToken(token) ?? parsePeriodToken(REGISTRY_DEFAULT_PERIOD)!;
  const since = periodStart(parsed, now);
  return {
    token,
    label: periodLabel(token),
    since: since.toISOString(),
    until: now.toISOString(),
    months: monthKeys(since, now),
    options: options.length ? options : [{ token, label: periodLabel(token) }],
  };
}
