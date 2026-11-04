// src/lib/services/approval/approvers.test.ts
import { describe, expect, it, vi } from "vitest";
import { getApproversForSubscription } from "./approvers";

const prisma = vi.hoisted(() => ({ approvalRequest: { findFirst: vi.fn() } }));
vi.mock("@/lib/db", () => ({ prisma }));

describe("getApproversForSubscription", () => {
  it("returns unique approver ids of approved steps", async () => {
    prisma.approvalRequest.findFirst.mockResolvedValue({
      steps: [{ approverId: "a" }, { approverId: "b" }, { approverId: "a" }],
    });
    expect(await getApproversForSubscription("sub-1")).toEqual(["a", "b"]);
    expect(prisma.approvalRequest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { subscriptionId: "sub-1", status: "APPROVED" },
      })
    );
  });

  it("returns an empty list when no approved request is linked", async () => {
    prisma.approvalRequest.findFirst.mockResolvedValue(null);
    expect(await getApproversForSubscription("sub-x")).toEqual([]);
  });
});
