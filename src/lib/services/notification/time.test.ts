// src/lib/services/notification/time.test.ts
import { describe, expect, it } from "vitest";
import {
  dateKeyToUtcDate,
  diffDateKeys,
  getZonedParts,
  isScheduledSlotReached,
  isWithinWindow,
  parseHHMM,
  quietHoursEndsAt,
  shiftDateKey,
  toDateKey,
} from "./time";

describe("time helpers", () => {
  it("converts an instant to calendar parts in a time zone", () => {
    // 2024-03-10 22:30 UTC == 2024-03-11 02:30 in Dubai (+4)
    const parts = getZonedParts(new Date("2024-03-10T22:30:00Z"), "Asia/Dubai");
    expect(parts).toMatchObject({
      year: 2024,
      month: 3,
      day: 11,
      hour: 2,
      minute: 30,
    });
    expect(parts.weekday).toBe(1); // Monday
  });

  it("builds date keys per zone and shifts them by calendar days", () => {
    const d = new Date("2024-03-10T22:30:00Z");
    expect(toDateKey(d, "UTC")).toBe("2024-03-10");
    expect(toDateKey(d, "Asia/Dubai")).toBe("2024-03-11");
    expect(shiftDateKey("2024-03-01", -1)).toBe("2024-02-29");
    expect(shiftDateKey("2024-12-31", 1)).toBe("2025-01-01");
    expect(diffDateKeys("2024-03-01", "2024-03-08")).toBe(7);
    expect(dateKeyToUtcDate("2024-03-01").toISOString()).toBe(
      "2024-03-01T00:00:00.000Z"
    );
  });

  it("falls back to UTC for invalid time zones", () => {
    expect(toDateKey(new Date("2024-03-10T22:30:00Z"), "Not/AZone")).toBe(
      "2024-03-10"
    );
  });

  it("parses HH:MM", () => {
    expect(parseHHMM("08:30")).toBe(510);
    expect(parseHHMM("24:00")).toBeNull();
    expect(parseHHMM(null)).toBeNull();
  });

  it("evaluates windows that may wrap midnight", () => {
    expect(isWithinWindow(23 * 60, 22 * 60, 7 * 60)).toBe(true);
    expect(isWithinWindow(3 * 60, 22 * 60, 7 * 60)).toBe(true);
    expect(isWithinWindow(12 * 60, 22 * 60, 7 * 60)).toBe(false);
    expect(isWithinWindow(10 * 60, 9 * 60, 17 * 60)).toBe(true);
    expect(isWithinWindow(10 * 60, 9 * 60, 9 * 60)).toBe(false);
  });

  it("computes when quiet hours end", () => {
    // 23:00 Dubai == 19:00 UTC; quiet 22:00→07:00 → ends in 8h
    const now = new Date("2024-03-10T19:00:00Z");
    const end = quietHoursEndsAt(now, {
      start: "22:00",
      end: "07:00",
      timeZone: "Asia/Dubai",
    });
    expect(end?.toISOString()).toBe("2024-03-11T03:00:00.000Z");
    expect(
      quietHoursEndsAt(new Date("2024-03-10T08:00:00Z"), {
        start: "22:00",
        end: "07:00",
        timeZone: "Asia/Dubai",
      })
    ).toBeNull();
    expect(
      quietHoursEndsAt(now, { start: null, end: null, timeZone: "UTC" })
    ).toBeNull();
  });

  it("gates a weekly slot by weekday and time", () => {
    const monday0900Dubai = new Date("2024-03-11T05:00:00Z");
    expect(
      isScheduledSlotReached(monday0900Dubai, "Asia/Dubai", 1, "08:00")
    ).toBe(true);
    expect(
      isScheduledSlotReached(monday0900Dubai, "Asia/Dubai", 1, "10:00")
    ).toBe(false);
    expect(
      isScheduledSlotReached(monday0900Dubai, "Asia/Dubai", 2, "08:00")
    ).toBe(false);
  });
});
