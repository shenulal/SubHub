// src/lib/services/approval/decision.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { approveRequest, rejectRequest } from "./decision";
import { ApprovalError } from "./shared";

const prisma = vi.hoisted(() => ({
  approvalRequest: { findFirst: vi.fn(), update: vi.fn() },
  approvalStep: { update: vi.fn() },
  approvalEvent: { create: vi.fn() },
  auditLog: { create: vi.fn() },
  app: { findFirst: vi.fn(), create: vi.fn() },
  subscription: { create: vi.fn() },
  billingCycleConfig: { findMany: vi.fn() },
  $transaction: vi.fn(),
}));
const notify = vi.hoisted(() => vi.fn());
const settings = vi.hoisted(() => ({
  "approvals.autoCreateSubscription": true,
  "approvals.defaultReminderAfterDays": 2,
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
    async (_org: string, key: keyof typeof settings) => settings[key]
  ),
  getSettings: vi.fn(async (_org: string, keys: (keyof typeof settings)[]) =>
    Object.fromEntries(keys.map((k) => [k, settings[k]]))
  ),
}));

const NOW = new Date("2026-03-01T10:00:00Z");

function request(overrides: Record<string, unknown> = {}) {
  return {
    id: "req-1",
    organizationId: "org",
    requesterId: "u-req",
    policyId: "p1",
    catalogId: null,
    categoryId: "cat-1",
    costCenterId: null,
    subscriptionId: null,
    serviceName: "Figma",
    vendorWebsite: null,
    amount: 1200,
    currency: "AED",
    billingCycle: "YEARLY",
    monthlyAmount: 100,
    seats: 5,
    justification: "We need design tooling for the product team.",
    status: "PENDING",
    currentStep: 1,
    submittedAt: NOW,
    decidedAt: null,
    lastReminderAt: null,
    escalatedAt: null,
    metadata: {
      stepCandidates: { "1": ["u-mgr"], "2": ["fin-1", "fin-2"] },
      candidateIds: ["u-mgr"],
    },
    policy: { id: "p1", reminderAfterDays: 3, escalationAfterDays: null },
    requester: { id: "u-req", name: "Rania", email: "rania@acme.test" },
    steps: [
      {
        id: "s1",
        stepOrder: 1,
        label: "Manager",
        approverId: "u-mgr",
        status: "PENDING",
        updatedAt: NOW,
        dueAt: null,
      },
      {
        id: "s2",
        stepOrder: 2,
        label: "Finance",
        approverId: "fin-1",
        status: "WAITING",
        updatedAt: NOW,
        dueAt: null,
      },
    ],
    ...overrides,
  };
}

const manager = {
  userId: "u-mgr",
  role: "MEMBER",
  permissions: new Set(["approvals:decide"]),
};
const finance2 = {
  userId: "fin-2",
  role: "APPROVER",
  permissions: new Set(["approvals:decide"]),
};
const stranger = {
  userId: "nobody",
  role: "MEMBER",
  permissions: new Set(["approvals:decide"]),
};
const admin = {
  userId: "admin",
  role: "ADMIN",
  permissions: new Set<string>(),
};

describe("approveRequest", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prisma.$transaction.mockImplementation(
      async (fn: (tx: typeof prisma) => unknown) => fn(prisma)
    );
    prisma.billingCycleConfig.findMany.mockResolvedValue([
      { cycle: "YEARLY", months: 12 },
    ]);
    prisma.app.findFirst.mockResolvedValue(null);
    prisma.app.create.mockResolvedValue({ id: "app-1" });
    prisma.subscription.create.mockResolvedValue({ id: "sub-1" });
    settings["approvals.autoCreateSubscription"] = true;
  });

  it("advances to the next step, uses the policy reminder window and notifies the next approvers", async () => {
    prisma.approvalRequest.findFirst.mockResolvedValue(request());
    const result = await approveRequest(
      "org",
      manager,
      "req-1",
      "Looks good",
      NOW
    );

    expect(result).toEqual({ id: "req-1", status: "PENDING", currentStep: 2 });
    expect(prisma.approvalStep.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "s1" },
        data: expect.objectContaining({
          status: "APPROVED",
          approverId: "u-mgr",
          comment: "Looks good",
        }),
      })
    );
    expect(prisma.approvalStep.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "s2" },
        data: { status: "PENDING", dueAt: new Date("2026-03-04T10:00:00Z") },
      })
    );
    expect(prisma.approvalRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currentStep: 2,
          metadata: expect.objectContaining({
            candidateIds: ["fin-1", "fin-2"],
          }),
        }),
      })
    );
    expect(prisma.approvalEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "APPROVED" }),
      })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "APPROVAL_REQUEST_APPROVED",
          entityType: "approval_request",
        }),
      })
    );
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "APPROVAL_REQUESTED",
        userIds: ["fin-1", "fin-2"],
      })
    );
    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });

  it("final approval marks the request APPROVED, creates app + subscription and notifies the requester", async () => {
    prisma.approvalRequest.findFirst.mockResolvedValue(
      request({
        currentStep: 2,
        metadata: {
          stepCandidates: { "1": ["u-mgr"], "2": ["fin-1", "fin-2"] },
          candidateIds: ["fin-1", "fin-2"],
        },
        steps: [
          {
            id: "s1",
            stepOrder: 1,
            label: "Manager",
            approverId: "u-mgr",
            status: "APPROVED",
            updatedAt: NOW,
          },
          {
            id: "s2",
            stepOrder: 2,
            label: "Finance",
            approverId: "fin-1",
            status: "PENDING",
            updatedAt: NOW,
          },
        ],
      })
    );
    const result = await approveRequest("org", finance2, "req-1", null, NOW);

    expect(result).toEqual({
      id: "req-1",
      status: "APPROVED",
      currentStep: 2,
      subscriptionId: "sub-1",
    });
    expect(prisma.approvalStep.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "s2" },
        data: expect.objectContaining({ approverId: "fin-2" }),
      })
    );
    expect(prisma.approvalRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "APPROVED", decidedAt: NOW }),
      })
    );
    expect(prisma.app.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Figma",
          categoryId: "cat-1",
          ownerId: "u-req",
        }),
      })
    );
    expect(prisma.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          appId: "app-1",
          amount: 1200,
          currency: "AED",
          billingCycle: "YEARLY",
          totalLicenses: 5,
          ownerId: "u-req",
          status: "ACTIVE",
          reminderLeadDays: [7, 3, 1],
          renewalDate: new Date("2027-03-01T10:00:00Z"),
        }),
      })
    );
    expect(prisma.approvalRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { subscriptionId: "sub-1" } })
    );
    expect(prisma.approvalEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "SUBSCRIPTION_CREATED" }),
      })
    );
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "APPROVAL_DECIDED", userIds: ["u-req"] })
    );
  });

  it("skips subscription creation when the setting is off", async () => {
    settings["approvals.autoCreateSubscription"] = false;
    prisma.approvalRequest.findFirst.mockResolvedValue(
      request({
        steps: [
          {
            id: "s1",
            stepOrder: 1,
            label: "Manager",
            approverId: "u-mgr",
            status: "PENDING",
            updatedAt: NOW,
          },
        ],
      })
    );
    const result = await approveRequest("org", manager, "req-1", null, NOW);
    expect(result.status).toBe("APPROVED");
    expect(result.subscriptionId).toBeNull();
    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });

  it("rejects users who are not the current approver, but allows ADMIN", async () => {
    prisma.approvalRequest.findFirst.mockResolvedValue(request());
    await expect(
      approveRequest("org", stranger, "req-1", null, NOW)
    ).rejects.toMatchObject({
      code: "NOT_APPROVER",
    });
    await expect(
      approveRequest("org", admin, "req-1", null, NOW)
    ).resolves.toMatchObject({
      status: "PENDING",
    });
  });

  it("refuses decisions on non-pending requests and unknown ids", async () => {
    prisma.approvalRequest.findFirst.mockResolvedValueOnce(
      request({ status: "APPROVED" })
    );
    await expect(
      approveRequest("org", manager, "req-1", null, NOW)
    ).rejects.toBeInstanceOf(ApprovalError);
    prisma.approvalRequest.findFirst.mockResolvedValueOnce(null);
    await expect(
      approveRequest("org", manager, "missing", null, NOW)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("rejectRequest", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prisma.$transaction.mockImplementation(
      async (fn: (tx: typeof prisma) => unknown) => fn(prisma)
    );
  });

  it("ends the request immediately and notifies the requester with the comment", async () => {
    prisma.approvalRequest.findFirst.mockResolvedValue(request());
    const result = await rejectRequest(
      "org",
      manager,
      "req-1",
      "Too expensive",
      NOW
    );
    expect(result.status).toBe("REJECTED");
    expect(prisma.approvalStep.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "REJECTED",
          comment: "Too expensive",
        }),
      })
    );
    expect(prisma.approvalRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "REJECTED", decidedAt: NOW }),
      })
    );
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "APPROVAL_DECIDED",
        body: expect.stringContaining("Too expensive"),
      })
    );
  });
});
