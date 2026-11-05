// src/lib/services/payment/recurrence.utils.ts

/**
 * Parses the payment day (day of month)
 */
export function parseDayOfMonth(useDt: string): number | null {
  if (!useDt || useDt.length < 8) return null;
  const day = Number(useDt.slice(-2));
  return Number.isNaN(day) ? null : day;
}

/**
 * Parses the month key (YYYYMM)
 */
export function parseMonthKey(useDt: string): string | null {
  if (!useDt || useDt.length < 6) return null;
  return useDt.slice(0, 6);
}

/**
 * Parses the transaction time into minutes
 */
export function parseMinutes(useTm?: string | null): number | null {
  if (!useTm || useTm.length < 4) return null;
  const hour = Number(useTm.slice(0, 2));
  const minute = Number(useTm.slice(2, 4));
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  const total = hour * 60 + minute;
  if (total < 0 || total >= 24 * 60) return null;
  return total;
}

/**
 * Parses a date string (YYYYMMDD → Date)
 */
export function parseDateString(useDt: string): Date | null {
  if (!useDt || useDt.length < 8) return null;
  const year = Number(useDt.slice(0, 4));
  const month = Number(useDt.slice(4, 6)) - 1; // 0-indexed
  const day = Number(useDt.slice(6, 8));
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day))
    return null;
  return new Date(year, month, day);
}

/**
 * Calculates the amount variation ratio (standard deviation relative to the mean)
 */
export function calculateVariation(values: number[], avg: number): number {
  if (values.length <= 1 || avg === 0) return 0;

  const squaredDiffs = values.map((v) => Math.pow(v - avg, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return stdDev / avg;
}

/**
 * Calculates day variation (mean absolute deviation from the mean)
 */
export function calculateDayVariation(days: number[]): number {
  if (days.length <= 1) return 0;

  // End of month: days after the 28th are treated as month-end
  const normalizedDays = days.map((d) => (d >= 28 ? 28 : d));
  const normalizedAvg =
    normalizedDays.reduce((a, b) => a + b, 0) / normalizedDays.length;

  const absDiffs = normalizedDays.map((d) => Math.abs(d - normalizedAvg));
  return absDiffs.reduce((a, b) => a + b, 0) / absDiffs.length;
}
