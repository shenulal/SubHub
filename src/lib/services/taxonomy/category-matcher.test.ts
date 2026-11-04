import { describe, expect, it } from "vitest";

import type { CategoryRow } from "@/types/taxonomy";

import { CATEGORY_KEYWORD_RULES, matchKeywordRule } from "./category-keywords";
import {
  SUGGESTION_CONFIDENCE,
  suggestCategoryFromRows,
} from "./category-matcher";

const mk = (
  id: string,
  name: string,
  slug: string,
  parentId: string | null,
  isArchived = false
): CategoryRow => ({
  id,
  name,
  slug,
  parentId,
  icon: null,
  color: null,
  isArchived,
  isDefault: true,
  sortOrder: 0,
  budgetMonthly: null,
});

const rows: CategoryRow[] = [
  mk("software", "Software", "software", null),
  mk("design", "Design & Creative", "design", "software"),
  mk("ai", "AI Tools", "ai-tools", "software"),
  mk("comm", "Communication & Collaboration", "communication", "software"),
  mk("infra", "Infrastructure", "infrastructure", null),
  mk("cloud", "Cloud Hosting", "cloud-hosting", "infra"),
  mk("other", "Other", "other", null),
  mk("unc", "Uncategorised", "uncategorised", "other"),
  mk("archived", "Old AI", "ai-tools", "infra", true),
];

describe("matchKeywordRule", () => {
  it("matches brand keywords as whole tokens", () => {
    expect(matchKeywordRule("Figma Professional")?.rule.slug).toBe("design");
    expect(matchKeywordRule("figma.com")?.rule.slug).toBe("design");
  });
  it("does not treat very short keywords as substrings", () => {
    expect(matchKeywordRule("Mailchimp")?.rule.slug).toBe("marketing");
    expect(matchKeywordRule("Airtable")?.rule.slug).not.toBe("ai-tools");
  });
  it("returns null for empty or unknown text", () => {
    expect(matchKeywordRule("")).toBeNull();
    expect(matchKeywordRule("xyzzy")).toBeNull();
  });
  it("every rule points at a slug from the default tree shape", () => {
    for (const rule of CATEGORY_KEYWORD_RULES) {
      expect(rule.keywords.length).toBeGreaterThan(0);
      expect(rule.parentSlug).toMatch(/^[a-z-]+$/);
    }
  });
});

describe("suggestCategoryFromRows", () => {
  it("prefers an exact catalog category > subcategory match", () => {
    const s = suggestCategoryFromRows(
      {
        serviceName: "Whatever",
        catalogCategory: "Software > Design & Creative",
      },
      rows
    );
    expect(s).toMatchObject({
      categoryId: "design",
      parentId: "software",
      confidence: SUGGESTION_CONFIDENCE.catalogExact,
      reason: "catalog",
    });
  });
  it("matches a bare subcategory name from the catalog", () => {
    const s = suggestCategoryFromRows(
      { serviceName: "x", catalogCategory: "Cloud Hosting" },
      rows
    );
    expect(s.categoryId).toBe("cloud");
  });
  it("falls back to keyword rules on the service name", () => {
    const s = suggestCategoryFromRows({ serviceName: "Slack Pro" }, rows);
    expect(s.categoryId).toBe("comm");
    expect(s.reason).toBe("keyword:name:slack");
    expect(s.confidence).toBe(SUGGESTION_CONFIDENCE.keywordName);
  });
  it("uses the vendor domain with lower confidence", () => {
    const s = suggestCategoryFromRows(
      { serviceName: "Unknown Inc", vendorDomain: "app.vercel.com" },
      rows
    );
    expect(s.categoryId).toBe("cloud");
    expect(s.confidence).toBe(SUGGESTION_CONFIDENCE.keywordDomain);
  });
  it("never returns archived rows and prefers the right parent", () => {
    const s = suggestCategoryFromRows({ serviceName: "ChatGPT Team" }, rows);
    expect(s.categoryId).toBe("ai");
  });
  it("defaults to Other / Uncategorised, else no match", () => {
    expect(suggestCategoryFromRows({ serviceName: "Zzz" }, rows)).toMatchObject(
      { categoryId: "unc", parentId: "other", reason: "fallback" }
    );
    expect(suggestCategoryFromRows({ serviceName: "Zzz" }, [])).toMatchObject({
      categoryId: null,
      confidence: 0,
    });
  });
});
