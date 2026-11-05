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
        categoryIds: ["c1"],
        tagIds: ["t1"],
        ownerIds: ["u1"],
        teamIds: ["team1"],
        costCenterIds: ["cc1"],
        paymentMethodIds: ["pm1"],
        billingCycles: ["YEARLY"],
        amountMin: 5,
        amountMax: 50,
        renewingWithinDays: 10,
        trialOnly: true,
        includeArchived: true,
      },
      NOW
    );
    const and = (where.AND as Record<string, unknown>[]) ?? [];
    expect(and).toContainEqual({
      OR: [{ categoryId: "c1" }, { category: { parentId: "c1" } }],
    });
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

  it("matches a parent category's own rows and its children", () => {
    const where = filterToWhere(
      { categoryIds: ["p1"], includeArchived: true },
      NOW
    );
    expect(where).toEqual({
      AND: [{ OR: [{ categoryId: "p1" }, { category: { parentId: "p1" } }] }],
    });
  });

  it("uses `in` for several values of each facet", () => {
    const where = filterToWhere(
      {
        includeArchived: true,
        categoryIds: ["p1", "c2"],
        ownerIds: ["u1", "u2"],
        teamIds: ["t1", "t2"],
        costCenterIds: ["cc1", "cc2"],
        paymentMethodIds: ["pm1", "pm2"],
        billingCycles: ["MONTHLY", "YEARLY"],
      },
      NOW
    );
    const and = where.AND as Record<string, unknown>[];
    expect(and).toContainEqual({
      OR: [
        { categoryId: { in: ["p1", "c2"] } },
        { category: { parentId: { in: ["p1", "c2"] } } },
      ],
    });
    expect(and).toContainEqual({ ownerId: { in: ["u1", "u2"] } });
    expect(and).toContainEqual({
      OR: [
        { teamId: { in: ["t1", "t2"] } },
        { subscriptionTeams: { some: { teamId: { in: ["t1", "t2"] } } } },
      ],
    });
    expect(and).toContainEqual({ costCenterId: { in: ["cc1", "cc2"] } });
    expect(and).toContainEqual({ paymentMethodId: { in: ["pm1", "pm2"] } });
    expect(and).toContainEqual({ billingCycle: { in: ["MONTHLY", "YEARLY"] } });
  });

  it("ignores empty lists (empty selection = all)", () => {
    expect(
      filterToWhere(
        { includeArchived: true, ownerIds: [], teamIds: [], categoryIds: [] },
        NOW
      )
    ).toEqual({});
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
