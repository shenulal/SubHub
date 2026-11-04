import { describe, expect, it } from "vitest";
import {
  addUtcMonths,
  computeCancellationDeadline,
  diffUtcDays,
  getNoticeWindow,
  suggestRenewalDate,
  toIsoDate,
} from "./contract-terms";

describe("computeCancellationDeadline", () => {
  it("subtracts the notice period from the end date", () => {
    const deadline = computeCancellationDeadline({
      endDate: new Date("2026-12-31T00:00:00Z"),
      noticePeriodDays: 30,
    });
    expect(toIsoDate(deadline)).toBe("2026-12-01");
  });

  it("accepts ISO strings and a zero notice period", () => {
    const deadline = computeCancellationDeadline({
      endDate: "2026-03-01",
      noticePeriodDays: 0,
    });
    expect(toIsoDate(deadline)).toBe("2026-03-01");
  });

  it("returns null when inputs are missing or invalid", () => {
    expect(
      computeCancellationDeadline({ endDate: null, noticePeriodDays: 30 })
    ).toBeNull();
    expect(
      computeCancellationDeadline({
        endDate: "2026-03-01",
        noticePeriodDays: null,
      })
    ).toBeNull();
    expect(
      computeCancellationDeadline({
        endDate: "not-a-date",
        noticePeriodDays: 10,
      })
    ).toBeNull();
    expect(
      computeCancellationDeadline({
        endDate: "2026-03-01",
        noticePeriodDays: -1,
      })
    ).toBeNull();
  });

  it("crosses month and year boundaries", () => {
    const deadline = computeCancellationDeadline({
      endDate: "2027-01-15",
      noticePeriodDays: 45,
    });
    expect(toIsoDate(deadline)).toBe("2026-12-01");
  });
});

describe("getNoticeWindow", () => {
  const today = new Date("2026-11-04T10:00:00Z");

  it("reports no_deadline when missing", () => {
    expect(getNoticeWindow(null, today, 7)).toEqual({
      state: "no_deadline",
      daysUntilDeadline: null,
    });
  });

  it("reports upcoming, window_open and deadline_passed", () => {
    expect(getNoticeWindow("2026-12-01", today, 7).state).toBe("upcoming");
    expect(getNoticeWindow("2026-11-10", today, 7)).toEqual({
      state: "window_open",
      daysUntilDeadline: 6,
    });
    expect(getNoticeWindow("2026-11-04", today, 7).state).toBe("window_open");
    expect(getNoticeWindow("2026-11-01", today, 7)).toEqual({
      state: "deadline_passed",
      daysUntilDeadline: -3,
    });
  });
});

describe("addUtcMonths / suggestRenewalDate", () => {
  it("clamps to the last day of shorter months", () => {
    expect(toIsoDate(addUtcMonths(new Date("2026-01-31T00:00:00Z"), 1))).toBe(
      "2026-02-28"
    );
  });

  it("advances the start date until it is in the future", () => {
    const today = new Date("2026-11-04T00:00:00Z");
    expect(toIsoDate(suggestRenewalDate("2026-01-15", 1, today))).toBe(
      "2026-11-15"
    );
    expect(toIsoDate(suggestRenewalDate("2024-06-01", 12, today))).toBe(
      "2027-06-01"
    );
    expect(toIsoDate(suggestRenewalDate("2026-10-01", 3, today))).toBe(
      "2027-01-01"
    );
  });

  it("returns null for one-time cycles or missing start", () => {
    expect(suggestRenewalDate("2026-01-01", 0)).toBeNull();
    expect(suggestRenewalDate(null, 1)).toBeNull();
  });
});

describe("diffUtcDays", () => {
  it("ignores time-of-day", () => {
    expect(
      diffUtcDays(
        new Date("2026-11-04T23:59:00Z"),
        new Date("2026-11-06T00:01:00Z")
      )
    ).toBe(2);
  });
});
