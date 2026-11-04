// src/lib/services/notification/time.ts
/**
 * Time-zone helpers for reminders, digests and quiet hours.
 * Uses Intl only (no extra dependency); all inputs are IANA zone names from
 * `general.timezone`.
 */

const MS_PER_DAY = 86_400_000;
const MINUTES_PER_DAY = 24 * 60;

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number;
  minute: number;
  weekday: number; // 0 = Sunday
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function safeFormatter(timeZone: string): Intl.DateTimeFormat {
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  };
  try {
    return new Intl.DateTimeFormat("en-US", { ...options, timeZone });
  } catch {
    return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" });
  }
}

/** Calendar/clock parts of `date` as seen in `timeZone`. */
export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = safeFormatter(timeZone).formatToParts(date);
  const pick = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "0";
  return {
    year: Number(pick("year")),
    month: Number(pick("month")),
    day: Number(pick("day")),
    hour: Number(pick("hour")) % 24,
    minute: Number(pick("minute")),
    weekday: WEEKDAY_INDEX[pick("weekday")] ?? 0,
  };
}

/** `YYYY-MM-DD` of `date` in `timeZone`. */
export function toDateKey(date: Date, timeZone: string): string {
  const { year, month, day } = getZonedParts(date, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Shift a `YYYY-MM-DD` key by whole days (calendar arithmetic, DST-safe). */
export function shiftDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d) + days * MS_PER_DAY;
  return new Date(utc).toISOString().slice(0, 10);
}

/** Midnight UTC of a date key — a stable `targetDate` for dedupe rows. */
export function dateKeyToUtcDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

/** Whole-day difference between two date keys (b − a). */
export function diffDateKeys(a: string, b: string): number {
  return Math.round(
    (dateKeyToUtcDate(b).getTime() - dateKeyToUtcDate(a).getTime()) / MS_PER_DAY
  );
}

/** `HH:MM` → minutes since midnight. Returns null for invalid input. */
export function parseHHMM(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Whether `minuteOfDay` falls inside a quiet window. Windows may wrap midnight
 * (e.g. 22:00 → 07:00). Equal start/end means "no quiet hours".
 */
export function isWithinWindow(
  minuteOfDay: number,
  start: number,
  end: number
): boolean {
  if (start === end) return false;
  if (start < end) return minuteOfDay >= start && minuteOfDay < end;
  return minuteOfDay >= start || minuteOfDay < end;
}

export interface QuietHoursConfig {
  start: string | null;
  end: string | null;
  timeZone: string;
}

/**
 * If `now` is inside quiet hours, returns the instant quiet hours end;
 * otherwise null. Offset-based: minute-level accuracy is sufficient for mail.
 */
export function quietHoursEndsAt(
  now: Date,
  config: QuietHoursConfig
): Date | null {
  const start = parseHHMM(config.start);
  const end = parseHHMM(config.end);
  if (start === null || end === null) return null;
  const parts = getZonedParts(now, config.timeZone);
  const minuteOfDay = parts.hour * 60 + parts.minute;
  if (!isWithinWindow(minuteOfDay, start, end)) return null;
  const untilEnd =
    end > minuteOfDay ? end - minuteOfDay : MINUTES_PER_DAY - minuteOfDay + end;
  return new Date(now.getTime() + untilEnd * 60_000);
}

/** Whether `now` in `timeZone` matches weekday + is at/after `HH:MM`. */
export function isScheduledSlotReached(
  now: Date,
  timeZone: string,
  weekday: number,
  time: string
): boolean {
  const parts = getZonedParts(now, timeZone);
  if (parts.weekday !== weekday) return false;
  const target = parseHHMM(time);
  if (target === null) return true;
  return parts.hour * 60 + parts.minute >= target;
}
