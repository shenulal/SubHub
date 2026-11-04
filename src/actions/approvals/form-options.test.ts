// src/actions/approvals/form-options.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getApprovalFormOptions,
  getPolicyFormOptions,
  searchCatalog,
} from "./form-options";

const prisma = vi.hoisted(() => ({
  billingCycleConfig: { findMany: vi.fn() },
  category: { findMany: vi.fn() },
  costCenter: { findMany: vi.fn() },
  saaSCatalog: { findMany: vi.fn() },
  user: { findMany: vi.fn() },
}));
const requirePermission = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/rbac/service", () => ({
  requirePermission,
  isForbiddenError: (e: unknown) => (e as Error)?.name === "ForbiddenError",
}));
vi.mock("@/lib/settings/service", () => ({
  getSettings: vi.fn(async (_o: string, keys: string[]) =>
    Object.fromEntries(
      keys.map((k) => [
        k,
        {
          "finance.enabledCurrencies": ["AED", "USD"],
          "finance.baseCurrency": "AED",
          "approvals.justificationMinLength": 25,
          "approvals.defaultReminderAfterDays": 2,
          "approvals.defaultEscalationAfterDays": 5,
        }[k],
      ])
    )
  ),
  getSetting: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
  requirePermission.mockResolvedValue({
    organizationId: "org",
    userId: "u",
    role: "MEMBER",
    permissions: new Set(),
  });
  prisma.billingCycleConfig.findMany.mockResolvedValue([
    { cycle: "MONTHLY", label: "Monthly", months: 1 },
  ]);
  prisma.category.findMany.mockResolvedValue([
    { id: "c1", name: "Design", parentId: null, color: null, icon: null },
  ]);
  prisma.costCenter.findMany.mockResolvedValue([
    { id: "cc1", code: "CC1", name: "Product" },
  ]);
  prisma.user.findMany.mockResolvedValue([
    { id: "u1", name: "A", email: "a@acme.test", image: null },
  ]);
});

describe("form option actions", () => {
  it("assembles request form options from masters and settings", async () => {
    const res = await getApprovalFormOptions();
    expect(requirePermission).toHaveBeenCalledWith("approvals:create");
    expect(res.data).toEqual({
      currencies: ["AED", "USD"],
      defaultCurrency: "AED",
      cycles: [{ cycle: "MONTHLY", label: "Monthly", months: 1 }],
      categories: [
        { id: "c1", name: "Design", parentId: null, color: null, icon: null },
      ],
      costCenters: [{ id: "cc1", code: "CC1", name: "Product" }],
      justificationMinLength: 25,
    });
    expect(prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org", isArchived: false },
      })
    );
  });

  it("searches the catalogue by name or alias with a small limit", async () => {
    prisma.saaSCatalog.findMany.mockResolvedValue([
      {
        id: "k1",
        name: "Figma",
        website: null,
        logoUrl: null,
        category: "Design",
      },
    ]);
    const res = await searchCatalog("Fig");
    expect(res.data).toHaveLength(1);
    const args = prisma.saaSCatalog.findMany.mock.calls[0][0];
    expect(args.take).toBe(8);
    expect(args.where.OR[1]).toEqual({ aliases: { hasSome: ["Fig", "fig"] } });
    expect((await searchCatalog("")).data).toEqual([]);
  });

  it("assembles policy builder options", async () => {
    const res = await getPolicyFormOptions();
    expect(requirePermission).toHaveBeenCalledWith("approval_policies:read");
    expect(res.data).toMatchObject({
      roles: ["ADMIN", "APPROVER", "MEMBER"],
      defaultReminderAfterDays: 2,
      defaultEscalationAfterDays: 5,
      users: [{ id: "u1" }],
    });
  });
});
