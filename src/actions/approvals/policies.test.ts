// src/actions/approvals/policies.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteApprovalPolicy,
  getApprovalPolicies,
  reorderApprovalPolicies,
  setPolicyActive,
  upsertApprovalPolicy,
} from "./policies";

const prisma = vi.hoisted(() => ({
  approvalPolicy: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    aggregate: vi.fn(),
    count: vi.fn(),
  },
  approvalPolicyStep: { deleteMany: vi.fn() },
  category: { count: vi.fn() },
  user: { count: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
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

const row = {
  id: "p1",
  name: "Over 500",
  description: null,
  isActive: true,
  priority: 2,
  appliesToAll: false,
  costThreshold: 500,
  costThresholdCurrency: "AED",
  categoryIds: ["cat-1"],
  reminderAfterDays: null,
  escalationAfterDays: 7,
  steps: [
    {
      id: "s1",
      stepOrder: 1,
      label: "Manager",
      approverType: "MANAGER",
      approverUserId: null,
      approverRole: null,
      approverUser: null,
    },
  ],
  _count: { requests: 3 },
};
const input = {
  name: "Over 500",
  isActive: true,
  appliesToAll: false,
  costThreshold: "500",
  costThresholdCurrency: "aed",
  categoryIds: ["cat-1"],
  reminderAfterDays: "",
  escalationAfterDays: "7",
  steps: [
    { label: "Manager", approverType: "MANAGER" },
    { label: "Finance", approverType: "ROLE", approverRole: "APPROVER" },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
  requirePermission.mockResolvedValue({
    organizationId: "org",
    userId: "admin",
    role: "ADMIN",
    permissions: new Set(),
  });
  prisma.$transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === "function"
      ? arg(prisma)
      : Promise.all(arg as Promise<unknown>[])
  );
  prisma.category.count.mockResolvedValue(1);
  prisma.user.count.mockResolvedValue(0);
});

describe("getApprovalPolicies", () => {
  it("maps rows to the view model", async () => {
    prisma.approvalPolicy.findMany.mockResolvedValue([row]);
    const res = await getApprovalPolicies();
    expect(requirePermission).toHaveBeenCalledWith("approval_policies:read");
    expect(res.data?.[0]).toMatchObject({
      id: "p1",
      costThreshold: 500,
      requestCount: 3,
      steps: [{ stepOrder: 1 }],
    });
  });
});

describe("upsertApprovalPolicy", () => {
  it("creates a policy at the top priority with ordered steps", async () => {
    prisma.approvalPolicy.aggregate.mockResolvedValue({
      _max: { priority: 4 },
    });
    prisma.approvalPolicy.create.mockResolvedValue(row);
    const res = await upsertApprovalPolicy(input);
    expect(requirePermission).toHaveBeenCalledWith("approval_policies:manage");
    expect(res.success).toBe(true);
    expect(prisma.approvalPolicy.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          priority: 5,
          costThreshold: 500,
          costThresholdCurrency: "AED",
          escalationAfterDays: 7,
          reminderAfterDays: null,
          steps: {
            createMany: {
              data: [
                expect.objectContaining({
                  stepOrder: 1,
                  approverType: "MANAGER",
                  approverRole: null,
                }),
                expect.objectContaining({
                  stepOrder: 2,
                  approverType: "ROLE",
                  approverRole: "APPROVER",
                }),
              ],
            },
          },
        }),
      })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "CREATE_APPROVAL_POLICY" }),
      })
    );
  });

  it("updates an existing policy by replacing its steps", async () => {
    prisma.approvalPolicy.findFirst.mockResolvedValue({ id: "p1" });
    prisma.approvalPolicy.update.mockResolvedValue(row);
    const res = await upsertApprovalPolicy({
      ...input,
      id: "p1",
      appliesToAll: true,
    });
    expect(res.success).toBe(true);
    expect(prisma.approvalPolicyStep.deleteMany).toHaveBeenCalledWith({
      where: { policyId: "p1" },
    });
    expect(prisma.approvalPolicy.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          appliesToAll: true,
          costThreshold: null,
          categoryIds: [],
        }),
      })
    );
  });

  it("rejects a policy without any rule or with invalid steps", async () => {
    const noRule = await upsertApprovalPolicy({
      ...input,
      costThreshold: "",
      categoryIds: [],
    });
    expect(noRule.success).toBe(false);
    expect(noRule.errors?.appliesToAll).toBeDefined();

    const badStep = await upsertApprovalPolicy({
      ...input,
      steps: [{ label: "Who", approverType: "USER" }],
    });
    expect(badStep.success).toBe(false);
    expect(prisma.approvalPolicy.create).not.toHaveBeenCalled();
  });

  it("rejects categories or approvers outside the organisation", async () => {
    prisma.category.count.mockResolvedValue(0);
    const res = await upsertApprovalPolicy(input);
    expect(res).toMatchObject({
      success: false,
      error: "Unknown category selected",
    });
  });
});

describe("delete / activate / reorder", () => {
  it("deletes an owned policy and audits it", async () => {
    prisma.approvalPolicy.findFirst.mockResolvedValue({
      id: "p1",
      name: "Over 500",
    });
    const res = await deleteApprovalPolicy("p1");
    expect(res.success).toBe(true);
    expect(prisma.approvalPolicy.delete).toHaveBeenCalledWith({
      where: { id: "p1" },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "DELETE_APPROVAL_POLICY" }),
      })
    );
  });

  it("reports missing policies", async () => {
    prisma.approvalPolicy.findFirst.mockResolvedValue(null);
    expect((await deleteApprovalPolicy("x")).success).toBe(false);
    prisma.approvalPolicy.updateMany.mockResolvedValue({ count: 0 });
    expect((await setPolicyActive("x", false)).success).toBe(false);
  });

  it("toggles active state scoped to the organisation", async () => {
    prisma.approvalPolicy.updateMany.mockResolvedValue({ count: 1 });
    const res = await setPolicyActive("p1", false);
    expect(res.success).toBe(true);
    expect(prisma.approvalPolicy.updateMany).toHaveBeenCalledWith({
      where: { id: "p1", organizationId: "org" },
      data: { isActive: false },
    });
  });

  it("reorders by assigning descending priorities", async () => {
    prisma.approvalPolicy.count.mockResolvedValue(3);
    prisma.approvalPolicy.update.mockResolvedValue(row);
    const res = await reorderApprovalPolicies(["a", "b", "c"]);
    expect(res.success).toBe(true);
    expect(prisma.approvalPolicy.update).toHaveBeenCalledWith({
      where: { id: "a" },
      data: { priority: 3 },
    });
    expect(prisma.approvalPolicy.update).toHaveBeenCalledWith({
      where: { id: "c" },
      data: { priority: 1 },
    });
  });

  it("refuses reordering with foreign ids", async () => {
    prisma.approvalPolicy.count.mockResolvedValue(1);
    expect((await reorderApprovalPolicies(["a", "b"])).success).toBe(false);
  });
});
