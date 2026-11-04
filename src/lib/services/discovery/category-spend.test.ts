// src/lib/services/discovery/category-spend.test.ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import { flattenCategorySpend, rollUpCategories } from "./category-spend";

const parents = [
  { id: "p1", name: "Productivity", color: "#111" },
  { id: "p2", name: "Design", color: null },
];

describe("rollUpCategories", () => {
  it("adds children into their parent and sorts by spend", () => {
    const slices = rollUpCategories(
      [
        {
          categoryId: "p1",
          name: "Productivity",
          color: "#111",
          parentId: null,
          monthlyBase: 10,
          count: 1,
        },
        {
          categoryId: "c1",
          name: "Chat",
          color: null,
          parentId: "p1",
          monthlyBase: 40,
          count: 2,
        },
        {
          categoryId: "c2",
          name: "UI",
          color: null,
          parentId: "p2",
          monthlyBase: 25,
          count: 1,
        },
        {
          categoryId: null,
          name: "__uncategorised",
          color: null,
          parentId: null,
          monthlyBase: 5,
          count: 1,
        },
      ],
      parents
    );
    expect(slices.map((s) => s.name)).toEqual([
      "Productivity",
      "Design",
      "__uncategorised",
    ]);
    expect(slices[0]).toMatchObject({ monthlyBase: 50, count: 3 });
    expect(slices[0].children?.map((c) => c.name)).toEqual(["Chat"]);
    // Parent without direct subscriptions still appears via its children.
    expect(slices[1]).toMatchObject({
      categoryId: "p2",
      monthlyBase: 25,
      count: 1,
    });
  });

  it("treats a child whose parent is archived as a root slice", () => {
    const slices = rollUpCategories(
      [
        {
          categoryId: "c9",
          name: "Orphan",
          color: null,
          parentId: "gone",
          monthlyBase: 3,
          count: 1,
        },
      ],
      parents
    );
    expect(slices).toHaveLength(1);
    expect(slices[0].name).toBe("Orphan");
  });
});

describe("flattenCategorySpend", () => {
  it("emits a parent row followed by child rows with annual figures", () => {
    const rows = flattenCategorySpend([
      {
        categoryId: "p1",
        name: "Productivity",
        color: null,
        parentId: null,
        monthlyBase: 50.004,
        count: 3,
        children: [
          {
            categoryId: "c1",
            name: "Chat",
            color: null,
            parentId: "p1",
            monthlyBase: 40,
            count: 2,
          },
        ],
      },
    ]);
    expect(rows).toEqual([
      {
        parent: "Productivity",
        category: "",
        monthlyBase: 50,
        annualBase: 600.05,
        count: 3,
      },
      {
        parent: "Productivity",
        category: "Chat",
        monthlyBase: 40,
        annualBase: 480,
        count: 2,
      },
    ]);
  });
});
