import { describe, expect, it } from "vitest";
import {
  buildSubscriptionOrderBy,
  buildSubscriptionWhere,
  type ListVisibilityContext,
} from "./subscription-crud-read.where";

const admin: ListVisibilityContext = {
  organizationId: "org-1",
  userId: "user-1",
  role: "ADMIN",
  teamId: null,
  canReadAll: true,
};

const member: ListVisibilityContext = {
  ...admin,
  role: "MEMBER",
  teamId: "team-1",
  canReadAll: false,
};

describe("buildSubscriptionWhere", () => {
  it("hides archived rows and personal rows by default", () => {
    const where = buildSubscriptionWhere({}, admin);
    expect(where).toEqual({
      organizationId: "org-1",
      status: { not: "ARCHIVED" },
      AND: [{ isPersonal: false }],
    });
  });

  it("honours explicit status, statuses and includeArchived", () => {
    expect(buildSubscriptionWhere({ status: "ARCHIVED" }, admin).status).toBe(
      "ARCHIVED"
    );
    expect(
      buildSubscriptionWhere({ statuses: ["ACTIVE", "PAUSED"] }, admin).status
    ).toEqual({ in: ["ACTIVE", "PAUSED"] });
    expect(
      buildSubscriptionWhere({ includeArchived: true }, admin).status
    ).toBeUndefined();
  });

  it("scopes personal subscriptions to the caller", () => {
    const where = buildSubscriptionWhere({ scope: "personal" }, member);
    expect(where.AND).toContainEqual({ isPersonal: true, ownerId: "user-1" });
  });

  it("scope=all without read_all only adds own personal rows", () => {
    const where = buildSubscriptionWhere({ scope: "all" }, member);
    expect(where.AND).toContainEqual({
      OR: [{ isPersonal: false }, { isPersonal: true, ownerId: "user-1" }],
    });
    expect(buildSubscriptionWhere({ scope: "all" }, admin).AND).toBeUndefined();
  });

  it("applies legacy team visibility for members", () => {
    const where = buildSubscriptionWhere({}, member);
    expect(where.AND).toContainEqual({ teamId: "team-1" });
  });

  it("builds taxonomy, owner, cost-centre and amount filters", () => {
    const where = buildSubscriptionWhere(
      {
        appId: "app-1",
        billingCycle: "MONTHLY",
        categoryId: "cat-1",
        parentCategoryId: "parent-1",
        tagIds: ["t1", "t2"],
        ownerId: "owner-1",
        teamId: "team-9",
        costCenterId: "cc-1",
        paymentMethodId: "pm-1",
        amountMin: 10,
        amountMax: 100,
      },
      admin
    );
    expect(where).toMatchObject({
      appId: "app-1",
      billingCycle: "MONTHLY",
      categoryId: "cat-1",
      ownerId: "owner-1",
      costCenterId: "cc-1",
      paymentMethodId: "pm-1",
    });
    expect(where.AND).toEqual(
      expect.arrayContaining([
        {
          OR: [
            { categoryId: "parent-1" },
            { category: { parentId: "parent-1" } },
          ],
        },
        { tags: { some: { tagId: { in: ["t1", "t2"] } } } },
        {
          OR: [
            { teamId: "team-9" },
            { subscriptionTeams: { some: { teamId: "team-9" } } },
          ],
        },
        { amount: { gte: 10, lte: 100 } },
      ])
    );
  });

  it("searches across name, vendor, notes, tags and custom fields", () => {
    const where = buildSubscriptionWhere({ search: "sla" }, admin);
    const search = (where.AND as Array<{ OR?: unknown[] }>).find(
      (c) => Array.isArray(c.OR) && c.OR.length === 6
    );
    expect(search).toBeDefined();
    expect(search?.OR).toContainEqual({
      tags: {
        some: { tag: { name: { contains: "sla", mode: "insensitive" } } },
      },
    });
  });

  it("limits renewals to the requested window", () => {
    const now = new Date("2026-11-04T00:00:00Z");
    const where = buildSubscriptionWhere(
      { renewingWithinDays: 30 },
      admin,
      now
    );
    expect(where.AND).toContainEqual({
      renewalDate: { gte: now, lte: new Date("2026-12-04T00:00:00Z") },
    });
  });
});

describe("buildSubscriptionOrderBy", () => {
  it("maps relation sorts and defaults to renewalDate", () => {
    expect(buildSubscriptionOrderBy({ sortBy: "appName" })).toEqual({
      app: { name: "asc" },
    });
    expect(
      buildSubscriptionOrderBy({ sortBy: "category", sortOrder: "desc" })
    ).toEqual({ category: { name: "desc" } });
    expect(buildSubscriptionOrderBy({ sortBy: "owner" })).toEqual({
      owner: { name: "asc" },
    });
    expect(buildSubscriptionOrderBy({ sortBy: "status" })).toEqual({
      status: "asc",
    });
    expect(buildSubscriptionOrderBy({ sortBy: "amount" })).toEqual({
      amount: "asc",
    });
    expect(buildSubscriptionOrderBy({})).toEqual({ renewalDate: "asc" });
  });
});
