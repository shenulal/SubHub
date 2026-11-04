// src/lib/services/approval/submit.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { submitApprovalRequest } from "./submit";

const prisma = vi.hoisted(() => ({
  approvalRequest: { create: vi.fn(), update: vi.fn() },
  approvalStep: { createMany: vi.fn() },
  approvalEvent: { create: vi.fn() },
  auditLog: { create: vi.fn() },
  approvalPolicy: { findMany: vi.fn() },
  billingCycleConfig: { findMany: vi.fn() },
  exchangeRate: { findFirst: vi.fn() },
  user: { findFirst: vi.fn(), findMany: vi.fn() },
  team: { findFirst: vi.fn() },
  app: { findFirst: vi.fn(), create: vi.fn() },
  subscription: { create: vi.fn() },
  $transaction: vi.fn(),
}));
const notify = vi.hoisted(() => vi.fn());
const settings = vi.hoisted(() => ({
  "approvals.enabled": true,
  "approvals.allowSelfApproval": false,
  "approvals.defaultReminderAfterDays": 2,
  "approvals.autoCreateSubscription": true,
  "subscriptions.defaultReminderLeadDays": [7, 3, 1],
}));
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/services/notification/center", () => ({ notify }));
vi.mock("@/lib/services/notification/email.utils", () => ({
  getBaseUrl: () => "http://test",
}));
vi.mock("@/lib/settings/service", () => ({
  getSetting: vi.fn(
    async (_o: string, k: keyof typeof settings) => settings[k]
  ),
  getSettings: vi.fn(async (_o: string, keys: (keyof typeof settings)[]) =>
    Object.fromEntries(keys.map((k) => [k, settings[k]]))
  ),
}));

const NOW = new Date("2026-03-01T10:00:00Z");
const data = {
  serviceName: "Figma",
  catalogId: null,
  vendorWebsite: null,
  amount: 1200,
  currency: "AED",
  billingCycle: "YEARLY" as const,
  seats: 3,
  categoryId: "cat-1",
  costCenterId: null,
  justification: "Design tooling for the product squad.",
};
const policy = {
  id: "p1",
  name: "Over 50",
  isActive: true,
  priority: 1,
  appliesToAll: false,
  costThreshold: 50,
  costThresholdCurrency: "AED",
  categoryIds: [],
  reminderAfterDays: 4,
  escalationAfterDays: null,
  steps: [
    {
      stepOrder: 1,
      label: "Manager",
      approverType: "MANAGER",
      approverUserId: null,
      approverRole: null,
    },
    {
      stepOrder: 2,
      label: "Finance",
      approverType: "ROLE",
      approverUserId: null,
      approverRole: "APPROVER",
    },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
  settings["approvals.enabled"] = true;
  prisma.$transaction.mockImplementation(
    async (fn: (tx: typeof prisma) => unknown) => fn(prisma)
  );
  prisma.billingCycleConfig.findMany.mockResolvedValue([
    { cycle: "YEARLY", months: 12 },
  ]);
  prisma.exchangeRate.findFirst.mockResolvedValue(null);
  prisma.user.findFirst.mockImplementation(async ({ where }) =>
    where.id === "u-req"
      ? {
          id: "u-req",
          managerId: "u-mgr",
          teamId: null,
          name: "Rania",
          email: "r@acme.test",
        }
      : where.id === "u-mgr"
        ? { id: "u-mgr" }
        : null
  );
  prisma.user.findMany.mockImplementation(async ({ where }) =>
    where.role === "APPROVER" ? [{ id: "fin-1" }] : [{ id: "admin-1" }]
  );
  prisma.approvalRequest.create.mockResolvedValue({ id: "req-1" });
  prisma.app.findFirst.mockResolvedValue({ id: "app-1" });
  prisma.subscription.create.mockResolvedValue({ id: "sub-1" });
});

describe("submitApprovalRequest", () => {
  it("creates a PENDING request with resolved steps and notifies the first approver", async () => {
    prisma.approvalPolicy.findMany.mockResolvedValue([policy]);
    const result = await submitApprovalRequest({
      organizationId: "org",
      requesterId: "u-req",
      data,
      now: NOW,
    });

    expect(result).toEqual({
      id: "req-1",
      status: "PENDING",
      autoApproved: false,
      policyId: "p1",
    });
    expect(prisma.approvalRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          monthlyAmount: 100,
          status: "PENDING",
          policyId: "p1",
          currentStep: 1,
          metadata: expect.objectContaining({
            stepCandidates: { "1": ["u-mgr"], "2": ["fin-1"] },
            candidateIds: ["u-mgr"],
          }),
        }),
      })
    );
    expect(prisma.approvalStep.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          stepOrder: 1,
          approverId: "u-mgr",
          status: "PENDING",
          dueAt: new Date("2026-03-05T10:00:00Z"),
        }),
        expect.objectContaining({
          stepOrder: 2,
          approverId: "fin-1",
          status: "WAITING",
          dueAt: null,
        }),
      ],
    });
    expect(prisma.approvalEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "SUBMITTED", actorId: "u-req" }),
      })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "APPROVAL_REQUEST_SUBMITTED" }),
      })
    );
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "APPROVAL_REQUESTED",
        userIds: ["u-mgr"],
      })
    );
    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });

  it("auto-approves (and creates the subscription) when no policy matches", async () => {
    prisma.approvalPolicy.findMany.mockResolvedValue([]);
    const result = await submitApprovalRequest({
      organizationId: "org",
      requesterId: "u-req",
      data,
      now: NOW,
    });

    expect(result.status).toBe("APPROVED");
    expect(result.autoApproved).toBe(true);
    expect(prisma.approvalStep.createMany).not.toHaveBeenCalled();
    const eventTypes = prisma.approvalEvent.create.mock.calls.map(
      (c) => c[0].data.type
    );
    expect(eventTypes).toEqual([
      "SUBMITTED",
      "APPROVED",
      "SUBSCRIPTION_CREATED",
    ]);
    expect(prisma.approvalEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "APPROVED",
          metadata: expect.objectContaining({ autoApproved: true }),
        }),
      })
    );
    expect(prisma.subscription.create).toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "APPROVAL_DECIDED", userIds: ["u-req"] })
    );
  });

  it("auto-approves when approvals are disabled without consulting policies", async () => {
    settings["approvals.enabled"] = false;
    const result = await submitApprovalRequest({
      organizationId: "org",
      requesterId: "u-req",
      data,
      now: NOW,
    });
    expect(result.autoApproved).toBe(true);
    expect(prisma.approvalPolicy.findMany).not.toHaveBeenCalled();
  });

  it("throws when the requester is not in the organisation", async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(
      submitApprovalRequest({
        organizationId: "org",
        requesterId: "ghost",
        data,
        now: NOW,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
