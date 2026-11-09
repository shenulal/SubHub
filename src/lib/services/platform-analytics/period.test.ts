// src/lib/services/platform-analytics/period.test.ts
import { describe, expect, it } from "vitest";

import {
  monthKeys,
  parsePeriodToken,
  periodLabel,
  periodOptions,
  resolvePeriod,
} from "./period";

const NOW = new Date("2026-11-09T08:00:00Z");
const ALLOWED = ["30d", "90d", "12m"];

describe("parsePeriodToken / periodLabel", () => {
  it("parses day and month tokens and rejects anything else", () => {
    expect(parsePeriodToken("30d")).toEqual({ amount: 30, unit: "d" });
    expect(parsePeriodToken("12m")).toEqual({ amount: 12, unit: "m" });
    expect(parsePeriodToken("0d")).toBeNull();
    expect(parsePeriodToken("12y")).toBeNull();
    expect(parsePeriodToken("'; drop")).toBeNull();
    expect(parsePeriodToken(undefined)).toBeNull();
  });

  it("labels periods in plain English", () => {
    expect(periodLabel("30d")).toBe("Last 30 days");
    expect(periodLabel("1m")).toBe("Last 1 month");
    expect(periodLabel("12m")).toBe("Last 12 months");
  });

  it("drops invalid and duplicate tokens from the options", () => {
    expect(periodOptions(["30d", "bad", "30d", "12m"])).toEqual([
      { token: "30d", label: "Last 30 days" },
      { token: "12m", label: "Last 12 months" },
    ]);
  });
});

describe("monthKeys", () => {
  it("lists every month across a year boundary, inclusive", () => {
    expect(
      monthKeys(new Date("2025-11-20T00:00:00Z"), new Date("2026-02-01Z"))
    ).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});

describe("resolvePeriod", () => {
  it("uses the requested period when it is allowed", () => {
    const p = resolvePeriod({
      requested: "12m",
      allowed: ALLOWED,
      fallback: "90d",
      now: NOW,
    });
    expect(p.token).toBe("12m");
    expect(p.since).toBe("2025-12-01T00:00:00.000Z");
    expect(p.months).toHaveLength(12);
    expect(p.months.at(-1)).toBe("2026-11");
  });

  it("falls back to the configured default for unknown periods", () => {
    const p = resolvePeriod({
      requested: "7d",
      allowed: ALLOWED,
      fallback: "90d",
      now: NOW,
    });
    expect(p.token).toBe("90d");
    expect(p.since).toBe("2026-08-11T08:00:00.000Z");
    expect(p.months).toEqual(["2026-08", "2026-09", "2026-10", "2026-11"]);
    expect(p.options.map((o) => o.token)).toEqual(ALLOWED);
  });

  it("uses the first allowed period when the default is not allowed", () => {
    const p = resolvePeriod({ allowed: ALLOWED, fallback: "7d", now: NOW });
    expect(p.token).toBe("30d");
  });
});
