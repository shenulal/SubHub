import { beforeEach, describe, expect, it, vi } from "vitest";

import { MockForbiddenError, deny, grant } from "./test-utils";

vi.mock("@/lib/db", () => ({
  prisma: {
    category: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/rbac/service", () => ({
  ForbiddenError: MockForbiddenError,
  isForbiddenError: (e: unknown) => e instanceof MockForbiddenError,
  requirePermission: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));
vi.mock("@/lib/logging", () => ({
  withLogging: (_n: string, fn: unknown) => fn,
}));

import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/service";

import {
  archiveCategory,
  createCategory,
  getCategoryPath,
  getCategoryTree,
  reorderCategories,
  restoreCategory,
  updateCategory,
} from "./categories";

const rp = vi.mocked(requirePermission);
const db = prisma as unknown as {
  category: Record<string, ReturnType<typeof vi.fn>>;
  auditLog: { create: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

const dbRow = (over: Record<string, unknown>) => ({
  id: "c",
  name: "Software",
  slug: "software",
  parentId: null,
  icon: null,
  color: null,
  isArchived: false,
  isDefault: false,
  sortOrder: 0,
  budgetMonthly: null,
  organizationId: "org-1",
  ...over,
});

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === "function"
      ? arg(prisma)
      : Promise.all(arg as Promise<unknown>[])
  );
});

describe("getCategoryTree", () => {
  it("builds a tree with usage counts and hides archived by default", async () => {
    grant(rp);
    db.category.findMany.mockResolvedValue([
      dbRow({
        id: "p",
        _count: { subscriptions: 2 },
        budgetMonthly: { toNumber: () => 100 },
      }),
      dbRow({
        id: "c",
        name: "Design",
        slug: "design",
        parentId: "p",
        _count: { subscriptions: 1 },
      }),
    ]);
    const tree = await getCategoryTree();
    expect(db.category.findMany.mock.calls[0][0].where).toEqual({
      organizationId: "org-1",
      isArchived: false,
    });
    expect(tree[0].children[0].name).toBe("Design");
    expect(tree[0].usageCount).toBe(2);
    expect(tree[0].budgetMonthly).toBe(100);
  });
  it("returns [] when forbidden", async () => {
    deny(rp);
    expect(await getCategoryTree({ includeArchived: true })).toEqual([]);
  });
});

describe("getCategoryPath", () => {
  it("returns parent and child", async () => {
    grant(rp);
    db.category.findFirst.mockResolvedValue({
      id: "c",
      name: "Design",
      parent: { id: "p", name: "Software" },
    });
    expect(await getCategoryPath("c")).toEqual({
      parent: { id: "p", name: "Software" },
      child: { id: "c", name: "Design" },
    });
  });
  it("returns null when not found", async () => {
    grant(rp);
    db.category.findFirst.mockResolvedValue(null);
    expect(await getCategoryPath("zzz")).toBeNull();
  });
});

describe("createCategory", () => {
  it("maps ForbiddenError to an error state", async () => {
    deny(rp);
    const result = await createCategory({ name: "X" });
    expect(result).toMatchObject({ success: false });
    expect(result.error).toMatch(/permission/);
  });
  it("validates input", async () => {
    grant(rp);
    const result = await createCategory({ name: "", color: "red" });
    expect(result.success).toBe(false);
    expect(result.errors?.name).toBeTruthy();
  });
  it("rejects a third level and unknown parents", async () => {
    grant(rp);
    db.category.findFirst.mockResolvedValueOnce(null);
    expect(
      (await createCategory({ name: "A", parentId: "nope" })).error
    ).toMatch(/Parent/);
    db.category.findFirst.mockResolvedValueOnce(
      dbRow({ id: "child", parentId: "p" })
    );
    expect(
      (await createCategory({ name: "A", parentId: "child" })).error
    ).toMatch(/two levels/);
  });
  it("makes the slug unique per parent, appends sortOrder and audits", async () => {
    grant(rp);
    db.category.findFirst.mockResolvedValue(dbRow({ id: "p" }));
    db.category.findMany.mockResolvedValue([
      { slug: "design", name: "Design", sortOrder: 4 },
    ]);
    db.category.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) =>
        dbRow({ id: "new", ...data })
    );
    const result = await createCategory({
      name: "Design!",
      parentId: "p",
      color: "#ff0000",
      budgetMonthly: 50,
    });
    expect(result.success).toBe(true);
    expect(db.category.create.mock.calls[0][0].data).toMatchObject({
      slug: "design-2",
      sortOrder: 5,
      parentId: "p",
      organizationId: "org-1",
      color: "#ff0000",
    });
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "CREATE_CATEGORY" }),
      })
    );
  });
  it("rejects duplicate names among siblings", async () => {
    grant(rp);
    db.category.findMany.mockResolvedValue([
      { slug: "design", name: "design", sortOrder: 0 },
    ]);
    expect((await createCategory({ name: "Design" })).error).toMatch(
      /already exists/
    );
  });
});

describe("updateCategory", () => {
  it("keeps the slug of default categories when renamed", async () => {
    grant(rp);
    db.category.findFirst.mockResolvedValue(
      dbRow({ id: "c", isDefault: true, slug: "design" })
    );
    db.category.findMany.mockResolvedValue([]);
    db.category.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) =>
        dbRow({ id: "c", ...data })
    );
    await updateCategory("c", { name: "Brand" });
    expect(db.category.update.mock.calls[0][0].data).toMatchObject({
      name: "Brand",
      slug: "design",
    });
  });
  it("re-slugs custom categories and 404s unknown ids", async () => {
    grant(rp);
    db.category.findFirst.mockResolvedValueOnce(null);
    expect((await updateCategory("x", { name: "Y" })).error).toMatch(
      /not found/
    );
    db.category.findFirst.mockResolvedValueOnce(
      dbRow({ id: "c", isDefault: false, slug: "old" })
    );
    db.category.findMany.mockResolvedValue([{ slug: "brand", name: "Other" }]);
    db.category.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) =>
        dbRow({ id: "c", ...data })
    );
    await updateCategory("c", { name: "Brand" });
    expect(db.category.update.mock.calls[0][0].data.slug).toBe("brand-2");
  });
});

describe("archive / restore", () => {
  it("archives a parent together with its children", async () => {
    grant(rp);
    db.category.findFirst.mockResolvedValue(dbRow({ id: "p" }));
    db.category.findMany.mockResolvedValue([{ id: "c1" }, { id: "c2" }]);
    db.category.updateMany.mockResolvedValue({ count: 3 });
    const result = await archiveCategory("p");
    expect(result).toMatchObject({ success: true, data: { affected: 3 } });
    expect(db.category.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: { in: ["p", "c1", "c2"] }, organizationId: "org-1" },
      data: { isArchived: true },
    });
  });
  it("restoring a child also restores its parent", async () => {
    grant(rp);
    db.category.findFirst.mockResolvedValue(dbRow({ id: "c1", parentId: "p" }));
    db.category.updateMany.mockResolvedValue({ count: 2 });
    await restoreCategory("c1");
    expect(db.category.updateMany.mock.calls[0][0].where.id.in).toEqual([
      "c1",
      "p",
    ]);
  });
});

describe("reorderCategories", () => {
  it("rejects ids outside the level and writes sortOrder otherwise", async () => {
    grant(rp);
    db.category.findMany.mockResolvedValueOnce([{ id: "a" }]);
    expect(
      (await reorderCategories({ parentId: null, orderedIds: ["a", "b"] }))
        .success
    ).toBe(false);
    db.category.findMany.mockResolvedValueOnce([{ id: "a" }, { id: "b" }]);
    db.category.update.mockImplementation(async (args: unknown) => args);
    db.auditLog.create.mockImplementation(async (args: unknown) => args);
    const result = await reorderCategories({
      parentId: null,
      orderedIds: ["b", "a"],
    });
    expect(result.success).toBe(true);
    expect(db.category.update).toHaveBeenCalledWith({
      where: { id: "b" },
      data: { sortOrder: 0 },
    });
    expect(db.category.update).toHaveBeenCalledWith({
      where: { id: "a" },
      data: { sortOrder: 1 },
    });
  });
});
