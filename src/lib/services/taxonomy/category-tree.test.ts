import { describe, expect, it } from "vitest";

import type { CategoryRow } from "@/types/taxonomy";

import {
  buildCategoryTree,
  findCategoryNode,
  flattenCategoryTree,
  nextUniqueSlug,
  slugify,
  toNumberOrNull,
} from "./category-tree";

const row = (
  over: Partial<CategoryRow> & { id: string; name: string }
): CategoryRow => ({
  slug: slugify(over.name),
  parentId: null,
  icon: null,
  color: null,
  isArchived: false,
  isDefault: false,
  sortOrder: 0,
  budgetMonthly: null,
  ...over,
});

describe("slugify", () => {
  it("lower-cases, replaces ampersands and collapses separators", () => {
    expect(slugify("Design & Creative")).toBe("design-and-creative");
    expect(slugify("  CRM / Sales!! ")).toBe("crm-sales");
    expect(slugify("Café Déjà")).toBe("cafe-deja");
  });
  it("falls back when nothing is left", () => {
    expect(slugify("!!!")).toBe("category");
  });
});

describe("nextUniqueSlug", () => {
  it("returns the base when free", () => {
    expect(nextUniqueSlug("design", ["software"])).toBe("design");
  });
  it("appends an increasing suffix per parent scope (case-insensitive)", () => {
    expect(nextUniqueSlug("design", ["Design", "design-2"])).toBe("design-3");
  });
});

describe("buildCategoryTree", () => {
  it("nests children under parents and sorts by sortOrder then name", () => {
    const rows = [
      row({ id: "p2", name: "Infrastructure", sortOrder: 1 }),
      row({ id: "c2", name: "Zeta", parentId: "p1", sortOrder: 1 }),
      row({ id: "p1", name: "Software", sortOrder: 0 }),
      row({ id: "c1", name: "Alpha", parentId: "p1", sortOrder: 0 }),
      row({ id: "c0", name: "Beta", parentId: "p1", sortOrder: 0 }),
    ];
    const tree = buildCategoryTree(rows);
    expect(tree.map((n) => n.id)).toEqual(["p1", "p2"]);
    expect(tree[0].children.map((n) => n.name)).toEqual([
      "Alpha",
      "Beta",
      "Zeta",
    ]);
    expect(tree[1].children).toEqual([]);
  });
  it("promotes orphans (archived/missing parent) to the root", () => {
    const tree = buildCategoryTree([
      row({ id: "c1", name: "Orphan", parentId: "missing" }),
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("c1");
  });
  it("does not mutate input rows", () => {
    const rows = [row({ id: "p1", name: "Software" })];
    buildCategoryTree(rows);
    expect("children" in rows[0]).toBe(false);
  });
});

describe("flatten/find", () => {
  const tree = buildCategoryTree([
    row({ id: "p1", name: "Software" }),
    row({ id: "c1", name: "Design", parentId: "p1" }),
  ]);
  it("flattens parents first", () => {
    expect(flattenCategoryTree(tree).map((n) => n.id)).toEqual(["p1", "c1"]);
  });
  it("finds nested nodes and tolerates null ids", () => {
    expect(findCategoryNode(tree, "c1")?.name).toBe("Design");
    expect(findCategoryNode(tree, null)).toBeUndefined();
  });
});

describe("toNumberOrNull", () => {
  it("handles Decimal-like, numbers, strings and null", () => {
    expect(toNumberOrNull({ toNumber: () => 12.5 })).toBe(12.5);
    expect(toNumberOrNull(3)).toBe(3);
    expect(toNumberOrNull("4.5")).toBe(4.5);
    expect(toNumberOrNull("abc")).toBeNull();
    expect(toNumberOrNull(null)).toBeNull();
  });
});
