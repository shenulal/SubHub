// src/lib/services/approval/reminders.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { processApprovalReminders } from "./reminders";

const prisma = vi.hoisted(() => ({
  approvalRequest: { findMany: vi.fn(), update: vi.fn() },
  approvalStep: { updateMany: vi.fn() },
  approvalEvent: { create: vi.fn() },
  auditLog: { create: vi.fn() },
  user: { findMany: vi.fn() },
}));
const notify = vi.hoisted(() => vi.fn());
const settings = vi.hoisted(() => ({
  "approvals.defaultReminderAfterDays": 2,
  "approvals.defaultEscalationAfterDays": 5,
  "approvals.escalateToRole": "ADMIN" as "ADMIN" | "APPROVER",
  "approvals.requestExpiryDays": 30 as number | null,
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

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-03-10T09:00:00Z");
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);

function pending(
  overrides: Record<string, unknown> = {},
  stepUpdatedAt = ago(1)
) {
  return {
    id: "req-1",
    organizationId: "org",
    requesterId: "u-req",
    serviceName: "Notion",
    currency: "AED",
    monthlyAmount: 40,
    status: "PENDING",
    currentStep: 1,
    submittedAt: ago(1),
    lastReminderAt: null,
    escalatedAt: null,
    metadata: { stepCandidates: { "1": ["u-mgr"] }, candidateIds: ["u-mgr"] },
    policy: null,
    requester: { id: "u-req", name: "Omar", email: "o@acme.test" },
    steps: [
      {
        id: "s1",
        stepOrder: 1,
        label: "Manager",
        approverId: "u-mgr",
        status: "PENDING",
        updatedAt: stepUpdatedAt,
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  settings["approvals.requestExpiryDays"] = 30;
  prisma.user.findMany.mockResolvedValue([{ id: "admin-1" }]);
});

describe("processApprovalReminders", () => {
  it("does nothing when the request is within the reminder window", async () => {
    prisma.approvalRequest.findMany.mockResolvedValue([pending({}, ago(1))]);
    const result = await processApprovalReminders(NOW);
    expect(result).toEqual({
      scanned: 1,
      reminded: 0,
      escalated: 0,
      expired: 0,
    });
    expect(notify).not.toHaveBeenCalled();
  });

  it("reminds the current approvers after reminderAfterDays and records lastReminderAt", async () => {
    prisma.approvalRequest.findMany.mockResolvedValue([
      pending({ submittedAt: ago(3) }, ago(3)),
    ]);
    const result = await processApprovalReminders(NOW);
    expect(result.reminded).toBe(1);
    expect(prisma.approvalRequest.update).toHaveBeenCalledWith({
      where: { id: "req-1" },
      data: { lastReminderAt: NOW },
    });
    expect(prisma.approvalEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "REMINDED" }),
      })
    );
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ userIds: ["u-mgr"] })
    );
  });

  it("does not remind again until the reminder window elapses since the last reminder", async () => {
    prisma.approvalRequest.findMany.mockResolvedValue([
      pending({ submittedAt: ago(4), lastReminderAt: ago(1) }, ago(4)),
    ]);
    const result = await processApprovalReminders(NOW);
    expect(result.reminded).toBe(0);
  });

  it("uses the policy's reminder window when set", async () => {
    prisma.approvalRequest.findMany.mockResolvedValue([
      pending(
        {
          submittedAt: ago(3),
          policy: { reminderAfterDays: 7, escalationAfterDays: 14 },
        },
        ago(3)
      ),
    ]);
    const result = await processApprovalReminders(NOW);
    expect(result.reminded).toBe(0);
  });

  it("escalates to the configured role after escalationAfterDays and widens the candidate list", async () => {
    prisma.approvalRequest.findMany.mockResolvedValue([
      pending({ submittedAt: ago(6) }, ago(6)),
    ]);
    const result = await processApprovalReminders(NOW);
    expect(result.escalated).toBe(1);
    expect(result.reminded).toBe(0);
    expect(prisma.approvalRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          escalatedAt: NOW,
          metadata: expect.objectContaining({
            candidateIds: ["u-mgr", "admin-1"],
            escalatedTo: ["admin-1"],
          }),
        }),
      })
    );
    expect(prisma.approvalEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "ESCALATED" }),
      })
    );
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "APPROVAL_ESCALATED",
        userIds: ["admin-1"],
      })
    );
  });

  it("escalates only once", async () => {
    prisma.approvalRequest.findMany.mockResolvedValue([
      pending(
        { submittedAt: ago(8), escalatedAt: ago(2), lastReminderAt: ago(2) },
        ago(8)
      ),
    ]);
    const result = await processApprovalReminders(NOW);
    expect(result.escalated).toBe(0);
    expect(result.reminded).toBe(1);
  });

  it("auto-cancels requests older than requestExpiryDays", async () => {
    prisma.approvalRequest.findMany.mockResolvedValue([
      pending({ submittedAt: ago(31) }, ago(31)),
    ]);
    const result = await processApprovalReminders(NOW);
    expect(result.expired).toBe(1);
    expect(prisma.approvalRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CANCELLED", decidedAt: NOW }),
      })
    );
    expect(prisma.approvalStep.updateMany).toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: ["u-req"],
        metadata: expect.objectContaining({ expired: true }),
      })
    );
  });

  it("never expires when requestExpiryDays is empty", async () => {
    settings["approvals.requestExpiryDays"] = null;
    prisma.approvalRequest.findMany.mockResolvedValue([
      pending(
        { submittedAt: ago(90), escalatedAt: ago(80), lastReminderAt: ago(1) },
        ago(90)
      ),
    ]);
    const result = await processApprovalReminders(NOW);
    expect(result.expired).toBe(0);
  });

  it("continues with other requests when one fails", async () => {
    prisma.approvalRequest.findMany.mockResolvedValue([
      pending({ id: "bad", submittedAt: ago(31) }, ago(31)),
      pending({ id: "good", submittedAt: ago(3) }, ago(3)),
    ]);
    prisma.approvalRequest.update.mockRejectedValueOnce(new Error("db down"));
    const result = await processApprovalReminders(NOW);
    expect(result.reminded).toBe(1);
    expect(result.expired).toBe(0);
  });
});
