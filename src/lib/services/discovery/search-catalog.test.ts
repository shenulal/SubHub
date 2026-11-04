// src/lib/services/discovery/search-catalog.test.ts
import { describe, expect, it } from "vitest";

import {
  matchesCatalog,
  normalizeQuery,
  SEARCH_CATALOG,
  searchCatalog,
} from "./search-catalog";

describe("search-catalog", () => {
  it("normalises whitespace and case", () => {
    expect(normalizeQuery("  Renewal   Pipeline ")).toBe("renewal pipeline");
  });

  it("matches when every token appears in title or keywords", () => {
    const pipeline = SEARCH_CATALOG.find((e) => e.id === "page-pipeline")!;
    expect(matchesCatalog(pipeline, "kanban")).toBe(true);
    expect(matchesCatalog(pipeline, "renewal kanban")).toBe(true);
    expect(matchesCatalog(pipeline, "renewal invoice")).toBe(false);
    expect(matchesCatalog(pipeline, "")).toBe(true);
  });

  it("gates entries by permission and respects the limit", () => {
    const viewer = new Set(["subscriptions:read"]);
    const results = searchCatalog("", viewer, 50);
    expect(results.every((r) => r.permission === "subscriptions:read")).toBe(
      true
    );
    expect(results.some((r) => r.id === "action-new-subscription")).toBe(false);

    const admin = new Set(
      SEARCH_CATALOG.map((e) => e.permission).filter(Boolean) as string[]
    );
    expect(searchCatalog("", admin, 3)).toHaveLength(3);
    expect(searchCatalog("invite", admin, 10).map((r) => r.id)).toEqual([
      "action-invite",
    ]);
  });
});
