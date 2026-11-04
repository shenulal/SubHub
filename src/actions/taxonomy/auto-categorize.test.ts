import { beforeEach, describe, expect, it, vi } from "vitest";

import { MockForbiddenError, deny, grant } from "./test-utils";

vi.mock("@/lib/db", () => ({
  prisma: {
    category: { findMany: vi.fn() },
    saaSCatalog: { findFirst: vi.fn() },
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

import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/service";

import { suggestCategory } from "./auto-categorize";

const rp = vi.mocked(requirePermission);
const db = prisma as unknown as {
  category: { findMany: ReturnType<typeof vi.fn> };
  saaSCatalog: { findFirst: ReturnType<typeof vi.fn> };
};
const cat = (
  id: string,
  name: string,
  slug: string,
  parentId: string | null
) => ({
  id,
  name,
  slug,
  parentId,
  icon: null,
  color: null,
  isArchived: false,
  isDefault: true,
  sortOrder: 0,
  budgetMonthly: null,
});
const rows = [
  cat("sw", "Software", "software", null),
  cat("design", "Design & Creative", "design", "sw"),
  cat("comm", "Communication & Collaboration", "communication", "sw"),
];

beforeEach(() => vi.resetAllMocks());

describe("suggestCategory", () => {
  it("looks the service up in the catalog when no catalog category is passed", async () => {
    grant(rp);
    db.saaSCatalog.findFirst.mockResolvedValue({
      category: "Software",
      subcategory: "Design & Creative",
    });
    db.category.findMany.mockResolvedValue(rows);
    const s = await suggestCategory({ serviceName: "Figma" });
    expect(s).toMatchObject({
      categoryId: "design",
      parentId: "sw",
      reason: "catalog",
    });
    expect(db.saaSCatalog.findFirst.mock.calls[0][0].where.OR[1]).toEqual({
      aliases: { has: "Figma" },
    });
  });
  it("falls back to keyword rules when the catalog has nothing", async () => {
    grant(rp);
    db.saaSCatalog.findFirst.mockResolvedValue(null);
    db.category.findMany.mockResolvedValue(rows);
    expect(
      (await suggestCategory({ serviceName: "Zoom Pro" })).categoryId
    ).toBe("comm");
  });
  it("returns the no-match shape when forbidden", async () => {
    deny(rp);
    expect(await suggestCategory({ serviceName: "x" })).toEqual({
      categoryId: null,
      parentId: null,
      confidence: 0,
      reason: "no-match",
    });
  });
});
