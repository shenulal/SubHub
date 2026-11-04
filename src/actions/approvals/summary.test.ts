// src/actions/approvals/summary.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPendingApprovalsSummary } from "./summary";

const prisma = vi.hoisted(() => ({
  approvalRequest: { findMany: vi.fn() },
  exchangeRate: { findFirst: vi.fn() },
}));
const requirePermission = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/settings/service", () => ({
  getSetting: vi.fn(async () => "AED"),
}));
vi.mock("@/lib/rbac/service", () => ({
  requirePermission,
  isForbiddenError: (e: unknown) => (e as Error)?.name === "ForbiddenError",
}));

function row(
  id: string,
  monthly: number,
  currency: string,
  approverId = "u-mgr"
) {
  return {
    id,
    serviceName: `Service ${id}`,
    vendorWebsite: null,
    amount: monthly * 12,
    currency,
    billingCycle: "YEARLY",
    monthlyAmount: monthly,
    seats: null,
    status: "PENDING",
    currentStep: 1,
    submittedAt: new Date("2026-03-01T00:00:00Z"),
    decidedAt: null,
    metadata: { candidateIds: [approverId] },
    requester: {
      id: "u-req",
      name: "Rania",
      email: "r@acme.test",
      image: null,
    },
    category: null,
    steps: [
      {
        id: `${id}-s1`,
        stepOrder: 1,
        label: "Manager",
        status: "PENDING",
        approverId,
        approver: {
          id: approverId,
          name: "Mgr",
          email: "m@acme.test",
          image: null,
        },
        comment: null,
        dueAt: null,
        decidedAt: null,
      },
    ],
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  prisma.exchangeRate.findFirst.mockImplementation(async ({ where }) =>
    where.baseCurrency === "USD" && where.quoteCurrency === "AED"
      ? { rate: 3.67 }
      : null
  );
});

describe("getPendingApprovalsSummary", () => {
  it("sums committed monthly spend in the base currency and returns the top items", async () => {
    requirePermission.mockResolvedValue({
      organizationId: "org",
      userId: "u-mgr",
      role: "APPROVER",
      permissions: new Set(["approvals:read"]),
    });
    prisma.approvalRequest.findMany.mockResolvedValue([
      row("a", 100, "AED"),
      row("b", 20, "USD"),
      row("c", 5, "AED"),
      row("d", 4, "AED"),
      row("e", 3, "AED"),
      row("f", 2, "AED"),
    ]);
    const result = await getPendingApprovalsSummary();
    expect(result.success).toBe(true);
    expect(result.data?.count).toBe(6);
    expect(result.data?.currency).toBe("AED");
    expect(result.data?.committedMonthly).toBe(100 + 73.4 + 5 + 4 + 3 + 2);
    expect(result.data?.items).toHaveLength(5);
    expect(result.data?.items[0]).toMatchObject({
      id: "a",
      isAwaitingMe: true,
      monthlyAmount: 100,
    });
    // scoped to the current user when read_all is missing
    expect(prisma.approvalRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
      })
    );
  });

  it("uses the organisation-wide scope with approvals:read_all", async () => {
    requirePermission.mockResolvedValue({
      organizationId: "org",
      userId: "admin",
      role: "ADMIN",
      permissions: new Set(["approvals:read", "approvals:read_all"]),
    });
    prisma.approvalRequest.findMany.mockResolvedValue([]);
    const result = await getPendingApprovalsSummary();
    expect(result.data).toEqual({
      count: 0,
      committedMonthly: 0,
      currency: "AED",
      items: [],
    });
    const where = prisma.approvalRequest.findMany.mock.calls[0][0].where;
    expect(where.OR).toBeUndefined();
  });

  it("maps ForbiddenError to a failed ActionState", async () => {
    const err = new Error("nope");
    err.name = "ForbiddenError";
    requirePermission.mockRejectedValue(err);
    const result = await getPendingApprovalsSummary();
    expect(result).toEqual({
      success: false,
      error: "nope",
      message: "FORBIDDEN",
    });
  });
});
