// src/lib/services/subscription/contract-terms.ts
/**
 * Pure contract-term helpers: cancellation deadline, notice window state,
 * renewal-date suggestion. All date maths is done in UTC day units.
 */

export const MS_PER_DAY = 86_400_000;

export interface ContractTermsInput {
  endDate: Date | string | null | undefined;
  noticePeriodDays: number | null | undefined;
}

/** Truncate a date to UTC midnight. */
export function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

export function addUtcDays(date: Date, days: number): Date {
  return new Date(startOfUtcDay(date).getTime() + days * MS_PER_DAY);
}

export function diffUtcDays(from: Date, to: Date): number {
  return Math.round(
    (startOfUtcDay(to).getTime() - startOfUtcDay(from).getTime()) / MS_PER_DAY
  );
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * cancellationDeadline = endDate − noticePeriodDays.
 * Returns null when either input is missing; a zero notice period yields the end date.
 */
export function computeCancellationDeadline({
  endDate,
  noticePeriodDays,
}: ContractTermsInput): Date | null {
  const end = toDate(endDate);
  if (!end || noticePeriodDays == null || noticePeriodDays < 0) return null;
  return addUtcDays(end, -noticePeriodDays);
}

export type NoticeWindowState =
  | "no_deadline"
  | "upcoming"
  | "window_open"
  | "deadline_passed";

export interface NoticeWindowInfo {
  state: NoticeWindowState;
  /** Days from `today` until the cancellation deadline (negative when passed). */
  daysUntilDeadline: number | null;
}

/**
 * Where a subscription sits relative to its cancellation deadline.
 * `window_open` means the deadline is within `windowDays` days (inclusive)
 * — the member must act now to avoid renewal.
 */
export function getNoticeWindow(
  deadline: Date | string | null | undefined,
  today: Date,
  windowDays: number
): NoticeWindowInfo {
  const target = toDate(deadline);
  if (!target) return { state: "no_deadline", daysUntilDeadline: null };
  const days = diffUtcDays(today, target);
  if (days < 0) return { state: "deadline_passed", daysUntilDeadline: days };
  if (days <= windowDays)
    return { state: "window_open", daysUntilDeadline: days };
  return { state: "upcoming", daysUntilDeadline: days };
}

/** Add calendar months in UTC, clamping to the last day of the target month. */
export function addUtcMonths(date: Date, months: number): Date {
  const base = startOfUtcDay(date);
  const targetMonthStart = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + months, 1)
  );
  const lastDay = new Date(
    Date.UTC(
      targetMonthStart.getUTCFullYear(),
      targetMonthStart.getUTCMonth() + 1,
      0
    )
  ).getUTCDate();
  return new Date(
    Date.UTC(
      targetMonthStart.getUTCFullYear(),
      targetMonthStart.getUTCMonth(),
      Math.min(base.getUTCDate(), lastDay)
    )
  );
}

/**
 * Suggest the next renewal date: start date advanced by `cycleMonths`
 * repeatedly until it lands strictly after `today`. Zero months (one-time)
 * yields null.
 */
export function suggestRenewalDate(
  startDate: Date | string | null | undefined,
  cycleMonths: number,
  today: Date = new Date()
): Date | null {
  const start = toDate(startDate);
  if (!start || cycleMonths <= 0) return null;
  let next = addUtcMonths(start, cycleMonths);
  const todayUtc = startOfUtcDay(today);
  // Guard against runaway loops on absurd inputs.
  let iterations = 0;
  while (next <= todayUtc && iterations < 1200) {
    next = addUtcMonths(next, cycleMonths);
    iterations++;
  }
  return next;
}

/** Format a date as YYYY-MM-DD (UTC). */
export function toIsoDate(date: Date | null | undefined): string {
  if (!date) return "";
  return startOfUtcDay(date).toISOString().slice(0, 10);
}
