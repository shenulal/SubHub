// src/lib/services/discovery/pipeline-buckets.test.ts
import type { PipelineCard } from "@/types/discovery";
import { describe, expect, it } from "vitest";

import {
  bucketPipeline,
  daysBetweenUtc,
  laneForDays,
} from "./pipeline-buckets";

const NOW = new Date("2026-11-04T23:30:00Z");
const OPTIONS = { now: NOW, weekDays: 7, monthDays: 30 };

function card(id: string, daysLeft: number, monthlyBase = 100): PipelineCard {
  return {
    id,
    appId: `app-${id}`,
    appName: id,
    appLogoUrl: null,
    amount: monthlyBase,
    currency: "AED",
    monthlyBase,
    annualBase: monthlyBase * 12,
    billingCycle: "MONTHLY",
    status: "ACTIVE",
    dueDate: new Date(NOW.getTime() + daysLeft * 86_400_000).toISOString(),
    daysLeft,
    owner: null,
    teamName: null,
    isTrial: false,
    isPersonal: false,
  };
}

describe("daysBetweenUtc", () => {
  it("compares on UTC calendar days regardless of time of day", () => {
    expect(
      daysBetweenUtc(
        new Date("2026-11-04T23:59:00Z"),
        new Date("2026-11-05T00:01:00Z")
      )
    ).toBe(1);
    expect(
      daysBetweenUtc(
        new Date("2026-11-04T00:01:00Z"),
        new Date("2026-11-04T23:59:00Z")
      )
    ).toBe(0);
    expect(
      daysBetweenUtc(
        new Date("2026-11-04T12:00:00Z"),
        new Date("2026-11-01T12:00:00Z")
      )
    ).toBe(-3);
  });

  it("is stable across DST-sized offsets", () => {
    expect(
      daysBetweenUtc(
        new Date("2026-03-28T12:00:00Z"),
        new Date("2026-03-30T11:00:00Z")
      )
    ).toBe(2);
  });
});

describe("laneForDays", () => {
  it("places boundaries inclusively", () => {
    expect(laneForDays(-1, OPTIONS)).toBe("overdue");
    expect(laneForDays(0, OPTIONS)).toBe("week");
    expect(laneForDays(7, OPTIONS)).toBe("week");
    expect(laneForDays(8, OPTIONS)).toBe("month");
    expect(laneForDays(30, OPTIONS)).toBe("month");
    expect(laneForDays(31, OPTIONS)).toBe("later");
  });

  it("honours the overdue grace period from settings", () => {
    expect(laneForDays(-2, { ...OPTIONS, overdueGraceDays: 2 })).toBe("week");
    expect(laneForDays(-3, { ...OPTIONS, overdueGraceDays: 2 })).toBe(
      "overdue"
    );
  });
});

describe("bucketPipeline", () => {
  it("groups renewals, totals each lane and keeps trials/notices separate", () => {
    const lanes = bucketPipeline(
      {
        renewals: [
          card("a", -5, 10),
          card("b", 3, 20),
          card("c", 20, 30),
          card("d", 90, 40),
        ],
        trialEndings: [card("t", 2, 5)],
        noticeDeadlines: [card("n", 10, 7)],
      },
      OPTIONS
    );
    const byKey = Object.fromEntries(lanes.map((l) => [l.key, l]));
    expect(byKey.overdue.cards.map((c) => c.id)).toEqual(["a"]);
    expect(byKey.week.cards.map((c) => c.id)).toEqual(["b"]);
    expect(byKey.month.cards.map((c) => c.id)).toEqual(["c"]);
    expect(byKey.later.cards.map((c) => c.id)).toEqual(["d"]);
    expect(byKey.trialEnding.count).toBe(1);
    expect(byKey.noticeDeadline.monthlyBase).toBe(7);
    expect(byKey.week.annualBase).toBe(240);
    expect(lanes.map((l) => l.key)).toEqual([
      "overdue",
      "week",
      "month",
      "later",
      "trialEnding",
      "noticeDeadline",
    ]);
  });

  it("sorts cards by days left within a lane and returns empty lanes", () => {
    const lanes = bucketPipeline(
      {
        renewals: [card("late", 6), card("soon", 1)],
        trialEndings: [],
        noticeDeadlines: [],
      },
      OPTIONS
    );
    const week = lanes.find((l) => l.key === "week");
    expect(week?.cards.map((c) => c.id)).toEqual(["soon", "late"]);
    expect(lanes.find((l) => l.key === "overdue")).toEqual({
      key: "overdue",
      count: 0,
      monthlyBase: 0,
      annualBase: 0,
      cards: [],
    });
  });

  it("does not mutate the input arrays", () => {
    const renewals = [card("x", 1)];
    bucketPipeline(
      { renewals, trialEndings: [], noticeDeadlines: [] },
      OPTIONS
    );
    expect(renewals).toHaveLength(1);
  });
});
