// src/actions/approvals/bulk-decisions.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bulkDecideRequests } from "./bulk-decisions";
import { getDecisionFormOptions } from "./decision-options";

const requirePermission = vi.hoisted(() => vi.fn());
const getSetting = vi.hoisted(() => vi.fn());
const decision = vi.hoisted(() => ({
  approveRequest: vi.fn(),
  rejectRequest: vi.fn(),
}));
const prisma = vi.hoisted(() => ({
  auditLog: { create: vi.fn() },
  approvalRejectionReason: { findMany: vi.fn() },
  costCenter: { findMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/settings/service", () => ({ getSetting }));
vi.mock("@/lib/rbac/service", () => ({
  requirePermission,
  isForbiddenError: (e: unknown) => (e as Error)?.name === "ForbiddenError",
}));
vi.mock("@/lib/services/approval/decision", () => decision);

const ctx = {
  userId: "qa-approver",
  organizationId: "org",
  role: "APPROVER",
  permissions: new Set(["approvals:decide"]),
};

beforeEach(() => {
  vi.resetAllMocks();
  requirePermission.mockResolvedValue(ctx);
  getSetting.mockResolvedValue(false);
});

function forbidden() {
  const error = new Error("Missing approvals:decide");
  error.name = "ForbiddenError";
  return error;
}

describe("bulkDecideRequests", () => {
  it("is denied without approvals:decide", async () => {
    requirePermission.mockRejectedValue(forbidden());
    const res = await bulkDecideRequests({
      requestIds: ["a"],
      action: "approve",
    });
    expect(res).toMatchObject({ success: false, message: "FORBIDDEN" });
    expect(decision.approveRequest).not.toHaveBeenCalled();
  });

  it("approves each request on its own and reports the ones that failed", async () => {
    const { ApprovalError } = await import("@/lib/services/approval/shared");
    decision.approveRequest
      .mockResolvedValueOnce({ id: "a", status: "APPROVED" })
      .mockRejectedValueOnce(
        new ApprovalError("NOT_PENDING", "Already decided")
      );
    const res = await bulkDecideRequests({
      requestIds: ["a", "b", "a"],
      action: "approve",
      comment: "Batch OK",
    });
    expect(res.success).toBe(true);
    expect(res.data).toEqual({
      succeeded: ["a"],
      failed: [{ id: "b", error: "Already decided" }],
    });
    expect(decision.approveRequest).toHaveBeenCalledTimes(2);
    expect(decision.approveRequest).toHaveBeenCalledWith(
      "org",
      expect.objectContaining({ userId: "qa-approver" }),
      "a",
      { comment: "Batch OK" }
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "BULK_APPROVAL_DECISION" }),
      })
    );
  });

  it("requires a reason and a comment to reject, and a comment to approve when configured", async () => {
    const reject = await bulkDecideRequests({
      requestIds: ["a"],
      action: "reject",
    });
    expect(reject.success).toBe(false);
    expect(reject.errors).toMatchObject({
      reasonId: expect.any(Array),
      comment: expect.any(Array),
    });
    getSetting.mockResolvedValue(true);
    const approve = await bulkDecideRequests({
      requestIds: ["a"],
      action: "approve",
    });
    expect(approve.errors?.comment).toBeDefined();
    expect(decision.rejectRequest).not.toHaveBeenCalled();
    expect(decision.approveRequest).not.toHaveBeenCalled();
  });

  it("forwards the reason to every rejection", async () => {
    decision.rejectRequest.mockResolvedValue({ id: "a", status: "REJECTED" });
    const res = await bulkDecideRequests({
      requestIds: ["a", "b"],
      action: "reject",
      reasonId: "r-dup",
      comment: "We already have this",
    });
    expect(res.data?.succeeded).toEqual(["a", "b"]);
    expect(decision.rejectRequest).toHaveBeenCalledWith(
      "org",
      expect.anything(),
      "b",
      { reasonId: "r-dup", comment: "We already have this" }
    );
  });

  it("caps the batch size", async () => {
    const res = await bulkDecideRequests({
      requestIds: Array.from({ length: 51 }, (_, i) => `r${i}`),
      action: "approve",
    });
    expect(res.success).toBe(false);
  });
});

describe("getDecisionFormOptions", () => {
  it("is denied without approvals:decide", async () => {
    requirePermission.mockRejectedValue(forbidden());
    const res = await getDecisionFormOptions();
    expect(res).toMatchObject({ success: false, message: "FORBIDDEN" });
  });

  it("returns active reasons, cost centres and the comment rule", async () => {
    getSetting.mockResolvedValue(true);
    prisma.approvalRejectionReason.findMany.mockResolvedValue([
      { id: "r1", name: "No budget", description: null },
    ]);
    prisma.costCenter.findMany.mockResolvedValue([
      { id: "cc", code: "MKT", name: "Marketing" },
    ]);
    const res = await getDecisionFormOptions();
    expect(res.data).toEqual({
      requireApproveComment: true,
      reasons: [{ id: "r1", name: "No budget", description: null }],
      costCenters: [{ id: "cc", code: "MKT", name: "Marketing" }],
      canManageCostCenters: false,
      canManageReasons: false,
    });
    expect(prisma.approvalRejectionReason.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org", isActive: true },
      })
    );
  });
});
