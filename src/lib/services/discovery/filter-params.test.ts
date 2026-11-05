// src/lib/services/discovery/filter-params.test.ts
import type { SubscriptionListQuery } from "@/types/discovery";
import { describe, expect, it } from "vitest";

import {
  ARCHIVED_PRESET,
  countActiveFilters,
  DEFAULT_SORT,
  parseFilterParams,
  parseListQuery,
  parsePageParams,
  parseSortParams,
  serializeListQuery,
} from "./filter-params";

const DEFAULT_LIMIT = 20;

describe("filter-params", () => {
  it("round-trips a fully populated query through the URL", () => {
    const query: SubscriptionListQuery = {
      filter: {
        search: "slack",
        categoryIds: ["cat-1", "cat-2"],
        tagIds: ["t1", "t2"],
        statuses: ["ACTIVE", "PAUSED"],
        includeArchived: true,
        ownerIds: ["u1", "u2"],
        teamIds: ["team-1"],
        costCenterIds: ["cc1", "cc2"],
        paymentMethodIds: ["pm1"],
        billingCycles: ["YEARLY", "MONTHLY"],
        amountMin: 10,
        amountMax: 500.5,
        renewingWithinDays: 30,
        trialOnly: true,
        scope: "personal",
      },
      sort: { sortBy: "amount", sortOrder: "desc" },
      page: 3,
      limit: 50,
    };

    const params = serializeListQuery(query, DEFAULT_LIMIT);
    const parsed = parseListQuery(params, DEFAULT_LIMIT);

    expect(parsed).toEqual(query);
  });

  it("omits defaults so bare URLs stay short", () => {
    const params = serializeListQuery(
      { filter: {}, sort: DEFAULT_SORT, page: 1, limit: DEFAULT_LIMIT },
      DEFAULT_LIMIT
    );
    expect(params.toString()).toBe("");
  });

  it("drops unknown enum values and malformed numbers", () => {
    const params = new URLSearchParams(
      "status=ACTIVE,BOGUS&cycle=WEEKLY&amountMin=abc&amountMax=-5&renewingWithin=7&sort=nope&order=sideways&page=0&limit=-1&scope=galaxy"
    );
    const filter = parseFilterParams(params);
    expect(filter.statuses).toEqual(["ACTIVE"]);
    expect(filter.billingCycles).toBeUndefined();
    expect(filter.amountMin).toBeUndefined();
    expect(filter.amountMax).toBeUndefined();
    expect(filter.renewingWithinDays).toBe(7);
    expect(filter.scope).toBeUndefined();
    expect(parseSortParams(params)).toEqual(DEFAULT_SORT);
    expect(parsePageParams(params, DEFAULT_LIMIT)).toEqual({
      page: 1,
      limit: DEFAULT_LIMIT,
    });
  });

  it("accepts Next.js searchParams records (string | string[])", () => {
    const filter = parseFilterParams({
      q: " notion ",
      tags: ["a,b", "ignored"],
      archived: "true",
    });
    expect(filter).toEqual({
      search: "notion",
      tagIds: ["a", "b", "ignored"],
      includeArchived: true,
    });
  });

  it("reads comma-separated multi-value facets and the legacy single value", () => {
    const filter = parseFilterParams(
      new URLSearchParams(
        "owner=u1,u2&team=t1&costCenter=cc1&paymentMethod=pm1,pm2&cycle=MONTHLY,YEARLY,WEEKLY"
      )
    );
    expect(filter.ownerIds).toEqual(["u1", "u2"]);
    expect(filter.teamIds).toEqual(["t1"]);
    expect(filter.costCenterIds).toEqual(["cc1"]);
    expect(filter.paymentMethodIds).toEqual(["pm1", "pm2"]);
    expect(filter.billingCycles).toEqual(["MONTHLY", "YEARLY"]);
  });

  it("folds the legacy category + parentCategory params into categoryIds", () => {
    expect(
      parseFilterParams(new URLSearchParams("category=c1&parentCategory=p1"))
        .categoryIds
    ).toEqual(["c1", "p1"]);
    expect(
      parseFilterParams(new URLSearchParams("parentCategory=p1")).categoryIds
    ).toEqual(["p1"]);
  });

  it("accepts repeated keys and serialises lists comma-separated", () => {
    const filter = parseFilterParams(new URLSearchParams("owner=u1&owner=u2"));
    expect(filter.ownerIds).toEqual(["u1", "u2"]);
    const params = serializeListQuery({ filter });
    expect(params.toString()).toBe("owner=u1%2Cu2");
  });

  it("treats an empty selection as no filter", () => {
    const params = serializeListQuery({
      filter: { ownerIds: [], teamIds: [], billingCycles: [] },
    });
    expect(params.toString()).toBe("");
    expect(parseFilterParams(new URLSearchParams("owner=&team=,"))).toEqual({});
  });

  it("dedupes list values and ignores empties", () => {
    expect(
      parseFilterParams(new URLSearchParams("tags=a,,a,b")).tagIds
    ).toEqual(["a", "b"]);
    expect(
      parseFilterParams(new URLSearchParams("tags=,")).tagIds
    ).toBeUndefined();
  });

  it("counts active filters without the scope facet", () => {
    expect(countActiveFilters({})).toBe(0);
    expect(countActiveFilters({ scope: "workspace" })).toBe(0);
    expect(
      countActiveFilters({
        search: "x",
        tagIds: [],
        statuses: ["ACTIVE"],
        trialOnly: false,
      })
    ).toBe(2);
  });

  it("serialises the archived preset used by the sub-nav", () => {
    const params = serializeListQuery({ filter: ARCHIVED_PRESET });
    expect(params.get("archived")).toBe("1");
    expect(params.get("status")).toBe("ARCHIVED");
  });
});
