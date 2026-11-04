// src/actions/approvals/decisions.test.ts
import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addComment,
  approveRequest,
  cancelRequest,
  provideInfo,
  rejectRequest,
  requestInfo,
} from "./decisions";

const requirePermission = vi.hoisted(() => vi.fn());
const decision = vi.hoisted(() => ({
  approveRequest: vi.fn(),
  rejectRequest: vi.fn(),
}));
const requestActions = vi.hoisted(() => ({
  requestInfo: vi.fn(),
  provideInfo: vi.fn(),
  cancelRequest: vi.fn(),
  addComment: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/settings/service", () => ({
  getSetting: vi.fn(),
  getSettings: vi.fn(),
}));
vi.mock("@/lib/rbac/service", () => ({
  requirePermission,
  isForbiddenError: (e: unknown) => (e as Error)?.name === "ForbiddenError",
}));
vi.mock("@/lib/services/approval/decision", () => decision);
vi.mock("@/lib/services/approval/request-actions", () => requestActions);

const ctx = {
  userId: "u-mgr",
  organizationId: "org",
  role: "APPROVER",
  permissions: new Set(["approvals:decide", "approvals:read"]),
};
const actor = {
  userId: "u-mgr",
  role: "APPROVER",
  permissions: ctx.permissions,
};
const ID = "req-1";

beforeEach(() => {
  vi.resetAllMocks();
  requirePermission.mockResolvedValue(ctx);
});

describe("decision actions", () => {
  it("approveRequest requires approvals:decide and forwards the actor", async () => {
    decision.approveRequest.mockResolvedValue({
      id: ID,
      status: "APPROVED",
      currentStep: 1,
      subscriptionId: "sub-1",
    });
    const res = await approveRequest(ID, "ok");
    expect(requirePermission).toHaveBeenCalledWith("approvals:decide");
    expect(decision.approveRequest).toHaveBeenCalledWith(
      "org",
      actor,
      ID,
      "ok"
    );
    expect(res.success).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith(`/approvals/${ID}`);
    expect(revalidatePath).toHaveBeenCalledWith("/subscriptions");
  });

  it("rejectRequest / requestInfo / provideInfo require a comment", async () => {
    for (const fn of [rejectRequest, requestInfo, provideInfo]) {
      const res = await fn(ID, "   ");
      expect(res.success).toBe(false);
      expect(res.errors?.comment).toBeDefined();
    }
    expect(decision.rejectRequest).not.toHaveBeenCalled();
    expect(requestActions.requestInfo).not.toHaveBeenCalled();
  });

  it("rejectRequest forwards the comment", async () => {
    decision.rejectRequest.mockResolvedValue({
      id: ID,
      status: "REJECTED",
      currentStep: 1,
    });
    const res = await rejectRequest(ID, "No budget");
    expect(decision.rejectRequest).toHaveBeenCalledWith(
      "org",
      actor,
      ID,
      "No budget"
    );
    expect(res.data?.status).toBe("REJECTED");
  });

  it("requestInfo uses approvals:decide; provideInfo, cancel and comment only need approvals:read", async () => {
    requestActions.requestInfo.mockResolvedValue({
      id: ID,
      status: "INFO_REQUESTED",
    });
    requestActions.provideInfo.mockResolvedValue({ id: ID, status: "PENDING" });
    requestActions.cancelRequest.mockResolvedValue({
      id: ID,
      status: "CANCELLED",
    });
    requestActions.addComment.mockResolvedValue({ id: ID, status: "PENDING" });

    await requestInfo(ID, "Which tier?");
    expect(requirePermission).toHaveBeenLastCalledWith("approvals:decide");
    await provideInfo(ID, "Pro tier");
    expect(requirePermission).toHaveBeenLastCalledWith("approvals:read");
    await cancelRequest(ID);
    expect(requirePermission).toHaveBeenLastCalledWith("approvals:read");
    expect(requestActions.cancelRequest).toHaveBeenCalledWith(
      "org",
      actor,
      ID,
      undefined
    );
    const res = await addComment(ID, "fyi");
    expect(requestActions.addComment).toHaveBeenCalledWith(
      "org",
      actor,
      ID,
      "fyi"
    );
    expect(res.success).toBe(true);
  });

  it("maps ApprovalError and ForbiddenError to failed ActionState", async () => {
    const { ApprovalError } = await import("@/lib/services/approval/shared");
    decision.approveRequest.mockRejectedValue(
      new ApprovalError("NOT_APPROVER", "nope")
    );
    expect(await approveRequest(ID)).toEqual({
      success: false,
      error: "nope",
      message: "NOT_APPROVER",
    });

    const forbidden = new Error("denied");
    forbidden.name = "ForbiddenError";
    requirePermission.mockRejectedValue(forbidden);
    expect(await approveRequest(ID)).toEqual({
      success: false,
      error: "denied",
      message: "FORBIDDEN",
    });
  });

  it("hides unexpected errors behind a generic message", async () => {
    decision.approveRequest.mockRejectedValue(new Error("boom"));
    const res = await approveRequest(ID);
    expect(res.success).toBe(false);
    expect(res.message).toBe("UNEXPECTED");
    expect(res.error).not.toContain("boom");
  });

  it("rethrows Next.js redirects", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;/login",
    });
    requirePermission.mockRejectedValue(redirect);
    await expect(approveRequest(ID)).rejects.toBe(redirect);
  });
});
