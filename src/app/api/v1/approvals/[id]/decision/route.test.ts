// src/app/api/v1/approvals/[id]/decision/route.test.ts
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  approveRequest: vi.fn(),
  rejectRequest: vi.fn(),
  requestInfo: vi.fn(),
  provideInfo: vi.fn(),
  cancelRequest: vi.fn(),
}));
vi.mock("@/actions/approvals/decisions", () => actions);
vi.mock("@/lib/api/auth-middleware", () => ({
  withApiAuth: (handler: (req: NextRequest) => Promise<Response>) => handler,
}));
vi.mock("@/lib/logging", () => ({
  withLogging: (_name: string, fn: unknown) => fn,
}));

import { POST } from "./route";

const call = (body: unknown) =>
  POST(
    new NextRequest("http://localhost/api/v1/approvals/req-1/decision", {
      method: "POST",
      body: JSON.stringify(body),
    })
  );

beforeEach(() => {
  vi.resetAllMocks();
  for (const fn of Object.values(actions)) {
    fn.mockResolvedValue({ success: true, data: { id: "req-1" } });
  }
});

describe("POST /api/v1/approvals/:id/decision", () => {
  it("keeps the legacy { action, comment } contract", async () => {
    expect((await call({ action: "reject", comment: "No" })).status).toBe(200);
    expect(actions.rejectRequest).toHaveBeenCalledWith("req-1", "No");
    await call({ action: "approve", comment: "ok" });
    expect(actions.approveRequest).toHaveBeenCalledWith(
      "req-1",
      expect.objectContaining({ comment: "ok", conditions: null })
    );
  });

  it("passes the captured fields of the new contract", async () => {
    await call({
      action: "reject",
      reasonId: "r-budget",
      comment: "Over budget",
    });
    expect(actions.rejectRequest).toHaveBeenCalledWith("req-1", {
      reasonId: "r-budget",
      comment: "Over budget",
    });
    await call({
      action: "approve",
      comment: "Go",
      conditions: "Annual plan",
      costCenterId: "cc-1",
      categoryId: "cat-1",
      effectiveStartDate: "2026-12-01",
    });
    expect(actions.approveRequest).toHaveBeenLastCalledWith("req-1", {
      comment: "Go",
      conditions: "Annual plan",
      costCenterId: "cc-1",
      categoryId: "cat-1",
      effectiveStartDate: "2026-12-01",
    });
  });

  it("maps action errors to HTTP status codes", async () => {
    actions.approveRequest.mockResolvedValue({
      success: false,
      error: "You are not an approver for the current step",
      message: "NOT_APPROVER",
    });
    expect((await call({ action: "approve" })).status).toBe(403);
    actions.rejectRequest.mockResolvedValue({
      success: false,
      error: "Please check your input",
      errors: { reasonId: ["Choose a rejection reason"] },
    });
    const res = await call({ action: "reject", reasonId: "x", comment: "" });
    expect(res.status).toBe(400);
    expect((await call({ action: "explode" })).status).toBe(400);
  });
});
