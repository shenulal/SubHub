// src/lib/services/approval/request-actions.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addComment,
  cancelRequest,
  provideInfo,
  requestInfo,
} from "./request-actions";

const prisma = vi.hoisted(() => ({
  approvalRequest: { findFirst: vi.fn(), update: vi.fn() },
  approvalStep: { update: vi.fn(), updateMany: vi.fn() },
  approvalEvent: { create: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
}));
const notify = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/services/notification/center", () => ({ notify }));
vi.mock("@/lib/services/notification/email.utils", () => ({
  getBaseUrl: () => "http://test",
}));
vi.mock("@/lib/settings/service", () => ({
  getSetting: vi.fn(async () => 2),
  getSettings: vi.fn(async () => ({})),
}));

const NOW = new Date("2026-03-01T10:00:00Z");
function request(overrides: Record<string, unknown> = {}) {
  return {
    id: "req-1",
    organizationId: "org",
    requesterId: "u-req",
    serviceName: "Figma",
    currency: "AED",
    monthlyAmount: 100,
    status: "PENDING",
    currentStep: 1,
    metadata: { stepCandidates: { "1": ["u-mgr"] }, candidateIds: ["u-mgr"] },
    policy: null,
    requester: { id: "u-req", name: "Rania", email: "r@acme.test" },
    steps: [
      {
        id: "s1",
        stepOrder: 1,
        label: "Manager",
        approverId: "u-mgr",
        status: "PENDING",
      },
    ],
    ...overrides,
  };
}
const manager = {
  userId: "u-mgr",
  role: "MEMBER",
  permissions: new Set<string>(),
};
const requester = {
  userId: "u-req",
  role: "MEMBER",
  permissions: new Set<string>(),
};
const stranger = {
  userId: "x",
  role: "MEMBER",
  permissions: new Set<string>(),
};

beforeEach(() => {
  vi.resetAllMocks();
  prisma.$transaction.mockImplementation(
    async (fn: (tx: typeof prisma) => unknown) => fn(prisma)
  );
});

describe("info loop", () => {
  it("requestInfo pauses the request and notifies the requester", async () => {
    prisma.approvalRequest.findFirst.mockResolvedValue(request());
    const result = await requestInfo(
      "org",
      manager,
      "req-1",
      "Which plan?",
      NOW
    );
    expect(result.status).toBe("INFO_REQUESTED");
    expect(prisma.approvalStep.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "INFO_REQUESTED" }),
      })
    );
    expect(prisma.approvalRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "INFO_REQUESTED" } })
    );
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "APPROVAL_INFO_REQUESTED",
        userIds: ["u-req"],
      })
    );
  });

  it("requestInfo is refused for non-approvers", async () => {
    prisma.approvalRequest.findFirst.mockResolvedValue(request());
    await expect(
      requestInfo("org", stranger, "req-1", "?", NOW)
    ).rejects.toMatchObject({ code: "NOT_APPROVER" });
  });

  it("provideInfo resumes the request and re-notifies the current approvers", async () => {
    prisma.approvalRequest.findFirst.mockResolvedValue(
      request({
        status: "INFO_REQUESTED",
        steps: [
          {
            id: "s1",
            stepOrder: 1,
            label: "Manager",
            approverId: "u-mgr",
            status: "INFO_REQUESTED",
          },
        ],
      })
    );
    const result = await provideInfo(
      "org",
      requester,
      "req-1",
      "The team plan.",
      NOW
    );
    expect(result.status).toBe("PENDING");
    expect(prisma.approvalStep.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "PENDING", dueAt: new Date("2026-03-03T10:00:00Z") },
      })
    );
    expect(prisma.approvalRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "PENDING", lastReminderAt: null },
      })
    );
    expect(prisma.approvalEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "INFO_PROVIDED" }),
      })
    );
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "APPROVAL_REQUESTED",
        userIds: ["u-mgr"],
      })
    );
  });

  it("provideInfo only works for the requester and only while info is requested", async () => {
    prisma.approvalRequest.findFirst.mockResolvedValue(
      request({ status: "INFO_REQUESTED" })
    );
    await expect(
      provideInfo("org", manager, "req-1", "x", NOW)
    ).rejects.toMatchObject({ code: "NOT_REQUESTER" });
    prisma.approvalRequest.findFirst.mockResolvedValue(request());
    await expect(
      provideInfo("org", requester, "req-1", "x", NOW)
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
  });
});

describe("cancelRequest", () => {
  it("lets the requester cancel an open request and skips open steps", async () => {
    prisma.approvalRequest.findFirst.mockResolvedValue(request());
    const result = await cancelRequest("org", requester, "req-1", null, NOW);
    expect(result.status).toBe("CANCELLED");
    expect(prisma.approvalStep.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "SKIPPED" } })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "APPROVAL_REQUEST_CANCELLED" }),
      })
    );
  });

  it("requires approvals:cancel_any for anyone else and refuses closed requests", async () => {
    prisma.approvalRequest.findFirst.mockResolvedValue(request());
    await expect(
      cancelRequest("org", stranger, "req-1", null, NOW)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const canceller = {
      ...stranger,
      permissions: new Set(["approvals:cancel_any"]),
    };
    await expect(
      cancelRequest("org", canceller, "req-1", null, NOW)
    ).resolves.toMatchObject({ status: "CANCELLED" });
    prisma.approvalRequest.findFirst.mockResolvedValue(
      request({ status: "APPROVED" })
    );
    await expect(
      cancelRequest("org", requester, "req-1", null, NOW)
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
  });
});

describe("addComment", () => {
  it("records a COMMENTED event for participants and refuses outsiders", async () => {
    prisma.approvalRequest.findFirst.mockResolvedValue(request());
    await addComment("org", manager, "req-1", "Checking with IT");
    expect(prisma.approvalEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "COMMENTED",
          comment: "Checking with IT",
        }),
      })
    );
    await expect(
      addComment("org", stranger, "req-1", "hi")
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
