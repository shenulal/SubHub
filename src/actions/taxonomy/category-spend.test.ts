import { beforeEach, describe, expect, it, vi } from "vitest";

import { MockForbiddenError, deny, grant } from "./test-utils";

vi.mock("@/lib/db", () => ({
  prisma: {
    billingCycleConfig: { findMany: vi.fn() },
    subscription: { findMany: vi.fn() },
    category: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/rbac/service", () => ({
  ForbiddenError: MockForbiddenError,
  isForbiddenError: (e: unknown) => e instanceof MockForbiddenError,
  requirePermission: vi.fn(),
}));
vi.mock("@/lib/settings/service", () => ({ getSetting: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/service";
import { getSetting } from "@/lib/settings/service";

import { getCategorySpend } from "./category-spend";

const rp = vi.mocked(requirePermission);
const db = prisma as unknown as Record<
  string,
  { findMany: ReturnType<typeof vi.fn> }
>;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getSetting).mockResolvedValue("AED" as never);
  db.billingCycleConfig.findMany.mockResolvedValue([
    { cycle: "MONTHLY", months: 1 },
    { cycle: "YEARLY", months: 12 },
    { cycle: "ONE_TIME", months: 0 },
  ]);
  db.category.findMany.mockResolvedValue([
    { id: "design", name: "Design", parent: { name: "Software" } },
  ]);
});

describe("getCategorySpend", () => {
  it("normalises per cycle, labels categories and the uncategorised bucket", async () => {
    grant(rp);
    db.subscription.findMany.mockResolvedValue([
      {
        categoryId: "design",
        amount: "1200",
        billingCycle: "YEARLY",
        currency: "USD",
      },
      {
        categoryId: "design",
        amount: 10,
        billingCycle: "MONTHLY",
        currency: "USD",
      },
      {
        categoryId: null,
        amount: 50,
        billingCycle: "MONTHLY",
        currency: "USD",
      },
      {
        categoryId: null,
        amount: 999,
        billingCycle: "ONE_TIME",
        currency: "USD",
      },
    ]);
    const rows = await getCategorySpend({ teamId: "team-1" });
    expect(rows).toEqual([
      {
        categoryId: "design",
        name: "Design",
        parentName: "Software",
        monthlyTotal: 110,
        currency: "AED",
        count: 2,
      },
      {
        categoryId: "__uncategorised__",
        name: "Uncategorised",
        parentName: null,
        monthlyTotal: 50,
        currency: "AED",
        count: 2,
      },
    ]);
    expect(db.subscription.findMany.mock.calls[0][0].where).toMatchObject({
      organizationId: "org-1",
      teamId: "team-1",
      archivedAt: null,
    });
  });
  it("returns [] when forbidden", async () => {
    deny(rp);
    expect(await getCategorySpend()).toEqual([]);
  });
});
