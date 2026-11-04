// src/lib/services/discovery/list-where.test.ts
import { describe, expect, it } from "vitest";

import {
  DEFAULT_VISIBLE_STATUSES,
  filterToWhere,
  sortToOrderBy,
} from "./list-where";

const NOW = new Date("2026-11-04T00:00:00Z");

describe("filterToWhere", () => {
  it("hides archived rows by default", () => {
    expect(filterToWhere({}, NOW)).toEqual({
      AND: [{ status: { in: DEFAULT_VISIBLE_STATUSES } }],
    });
  });

  it("includes archived rows when requested or explicitly filtered", () => {
    expect(filterToWhere({ includeArchived: true }, NOW)).toEqual({});
    expect(filterToWhere({ statuses: ["ARCHIVED"] }, NOW)).toEqual({
      AND: [{ status: { in: ["ARCHIVED"] } }],
    });
  });

  it("translates every facet", () => {
    const where = filterToWhere(
      {
        search: "slack",
        categoryId: "c1",
        tagIds: ["t1"],
        ownerId: "u1",
        teamId: "team1",
        costCenterId: "cc1",
        paymentMethodId: "pm1",
        billingCycle: "YEARLY",
        amountMin: 5,
        amountMax: 50,
        renewingWithinDays: 10,
        trialOnly: true,
        includeArchived: true,
      },
      NOW
    );
    const and = (where.AND as Record<string, unknown>[]) ?? [];
    expect(and).toContainEqual({ categoryId: "c1" });
    expect(and).toContainEqual({ tags: { some: { tagId: { in: ["t1"] } } } });
    expect(and).toContainEqual({ ownerId: "u1" });
    expect(and).toContainEqual({ costCenterId: "cc1" });
    expect(and).toContainEqual({ paymentMethodId: "pm1" });
    expect(and).toContainEqual({ billingCycle: "YEARLY" });
    expect(and).toContainEqual({ amount: { gte: 5, lte: 50 } });
    expect(and).toContainEqual({ isTrial: true });
    expect(and).toContainEqual({
      renewalDate: { gte: NOW, lte: new Date("2026-11-14T00:00:00Z") },
    });
    expect(JSON.stringify(where)).toContain('"contains":"slack"');
    expect(JSON.stringify(where)).toContain("subscriptionTeams");
  });

  it("uses the parent category (own + children) when no leaf is chosen", () => {
    const where = filterToWhere(
      { parentCategoryId: "p1", includeArchived: true },
      NOW
    );
    expect(where).toEqual({
      AND: [{ OR: [{ categoryId: "p1" }, { category: { parentId: "p1" } }] }],
    });
  });
});

describe("sortToOrderBy", () => {
  it("maps every sort field to a Prisma orderBy", () => {
    expect(sortToOrderBy({ sortBy: "appName", sortOrder: "desc" })).toEqual([
      { app: { name: "desc" } },
    ]);
    expect(sortToOrderBy({ sortBy: "category", sortOrder: "asc" })[0]).toEqual({
      category: { name: "asc" },
    });
    expect(sortToOrderBy({ sortBy: "owner", sortOrder: "asc" })[0]).toEqual({
      owner: { name: "asc" },
    });
    expect(sortToOrderBy({ sortBy: "status", sortOrder: "asc" })[0]).toEqual({
      status: "asc",
    });
    expect(sortToOrderBy({ sortBy: "amount", sortOrder: "desc" })).toEqual([
      { amount: "desc" },
    ]);
    expect(sortToOrderBy({ sortBy: "createdAt", sortOrder: "desc" })).toEqual([
      { createdAt: "desc" },
    ]);
    expect(
      sortToOrderBy({ sortBy: "renewalDate", sortOrder: "asc" })[0]
    ).toEqual({ renewalDate: "asc" });
  });
});
