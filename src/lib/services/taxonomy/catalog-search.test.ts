import { describe, expect, it } from "vitest";

import {
  CATALOG_SEARCH_MAX_LIMIT,
  normalizeQuery,
  rankCatalogItems,
  scoreCatalogItem,
  toStringArray,
} from "./catalog-search";

const items = [
  { name: "Slack", aliases: ["slack.com"] },
  { name: "Slackline Pro", aliases: [] },
  { name: "Microsoft Teams", aliases: ["Teams", "slack alternative"] },
  { name: "Jira", aliases: ["Atlassian Jira"] },
  { name: "Figma", aliases: [] },
];

describe("scoreCatalogItem", () => {
  it("ranks exact > name prefix > alias exact > alias prefix > contains", () => {
    expect(scoreCatalogItem(items[0], "slack")).toBe(0);
    expect(scoreCatalogItem(items[1], "slack")).toBe(1);
    expect(scoreCatalogItem(items[2], "teams")).toBe(2);
    expect(scoreCatalogItem(items[3], "atlas")).toBe(3);
    expect(scoreCatalogItem(items[2], "soft")).toBe(4);
    expect(scoreCatalogItem(items[2], "alternative")).toBe(5);
    expect(scoreCatalogItem(items[4], "slack")).toBeNull();
  });
});

describe("rankCatalogItems", () => {
  it("orders by score then name and respects the limit", () => {
    expect(rankCatalogItems(items, "Slack").map((i) => i.name)).toEqual([
      "Slack",
      "Slackline Pro",
      "Microsoft Teams",
    ]);
    expect(rankCatalogItems(items, "slack", 2)).toHaveLength(2);
  });
  it("returns nothing for a blank query and caps the limit", () => {
    expect(rankCatalogItems(items, "   ")).toEqual([]);
    expect(
      rankCatalogItems(
        Array.from({ length: 80 }, (_, i) => ({ name: `s${i}`, aliases: [] })),
        "s",
        500
      )
    ).toHaveLength(CATALOG_SEARCH_MAX_LIMIT);
  });
});

describe("helpers", () => {
  it("normalises queries and coerces json steps", () => {
    expect(normalizeQuery("  Hello   World ")).toBe("hello world");
    expect(toStringArray(["a", "", 3, "b"])).toEqual(["a", "b"]);
    expect(toStringArray("nope")).toEqual([]);
  });
});
