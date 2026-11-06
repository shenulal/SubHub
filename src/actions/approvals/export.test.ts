// src/actions/approvals/export.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { exportApprovals } from "./export";

const prisma = vi.hoisted(() => ({
  approvalRequest: { findMany: vi.fn() },
  auditLog: { create: vi.fn() },
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

beforeEach(() => {
  vi.resetAllMocks();
  requirePermission.mockResolvedValue({
    organizationId: "org",
    userId: "admin",
    role: "ADMIN",
    permissions: new Set(),
  });
  prisma.approvalRequest.findMany.mockResolvedValue([
    {
      id: "req-1",
      serviceName: "Figma, Pro",
      requester: { id: "u", name: null, email: "r@acme.test", image: null },
      status: "APPROVED",
      amount: 1200,
      currency: "AED",
      billingCycle: "YEARLY",
      monthlyAmount: 100,
      seats: 3,
      category: { name: "Design" },
      costCenter: { code: "CC1", name: "Product" },
      policy: { name: "Default" },
      steps: [
        {
          label: "Manager",
          status: "APPROVED",
          approver: { id: "m", name: "Mgr", email: "m@acme.test", image: null },
        },
        {
          label: "Finance",
          status: "WAITING",
          approver: { id: "f", name: "Fin", email: "f@acme.test", image: null },
        },
      ],
      submittedAt: new Date("2026-03-01T00:00:00Z"),
      decidedAt: new Date("2026-03-02T00:00:00Z"),
      justification: "Because.",
    },
  ]);
});

describe("exportApprovals", () => {
  it("produces a CSV with escaped values and audits the export", async () => {
    const res = await exportApprovals({ status: "APPROVED" });
    expect(requirePermission).toHaveBeenCalledWith("approvals:export");
    expect(res.success).toBe(true);
    expect(res.data?.rowCount).toBe(1);
    expect(res.data?.filename).toMatch(/^approvals-\d{4}-\d{2}-\d{2}\.csv$/);
    const lines = res.data!.csv.split("\n");
    expect(lines[0]).toContain("Request ID");
    expect(lines[1]).toContain('"Figma, Pro"');
    expect(lines[1]).toContain("Manager: Mgr (APPROVED)");
    expect(lines[1]).not.toContain("Finance:");
    expect(prisma.approvalRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org", status: "APPROVED" },
        take: 5000,
      })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "EXPORT_APPROVALS" }),
      })
    );
  });

  it("exports the captured decision (decided by, reason, comment, conditions, start date)", async () => {
    // Reuse the fixture from beforeEach as the base row.
    const [row] = await prisma.approvalRequest.findMany();
    prisma.approvalRequest.findMany.mockClear();
    prisma.approvalRequest.findMany.mockResolvedValue([
      {
        ...row,
        status: "REJECTED",
        rejectionReasonId: "r1",
        rejectionReasonName: "Security concern",
        decisionComment: "No SSO support",
        decisionConditions: null,
        effectiveStartDate: null,
        steps: [{ ...row.steps[0], status: "REJECTED", comment: null }],
      },
    ]);
    const res = await exportApprovals({});
    const [header, line] = res.data!.csv.replace(/^\uFEFF/, "").split("\n");
    expect(header).toContain(
      "Decided by,Rejection reason,Decision comment,Approval conditions,Effective start date"
    );
    expect(line).toContain("Mgr,Security concern,No SSO support");
  });

  it("ignores invalid filters instead of failing", async () => {
    const res = await exportApprovals({ status: "WHATEVER" });
    expect(res.success).toBe(true);
    expect(prisma.approvalRequest.findMany.mock.calls[0][0].where).toEqual({
      organizationId: "org",
    });
  });
});
