// src/actions/approvals/requests-read.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getApprovalRequest, getApprovalRequests } from "./requests-read";

const prisma = vi.hoisted(() => ({
  approvalRequest: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn() },
  user: { findMany: vi.fn() },
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

const approver = {
  id: "u-mgr",
  name: "Mgr",
  email: "m@acme.test",
  image: null,
};
const requester = {
  id: "u-req",
  name: "Rania",
  email: "r@acme.test",
  image: null,
};
const row = {
  id: "req-1",
  requesterId: "u-req",
  serviceName: "Figma",
  vendorWebsite: null,
  amount: 1200,
  currency: "AED",
  billingCycle: "YEARLY",
  monthlyAmount: 100,
  seats: null,
  status: "PENDING",
  currentStep: 1,
  submittedAt: new Date("2026-03-01T00:00:00Z"),
  decidedAt: null,
  escalatedAt: null,
  lastReminderAt: null,
  subscriptionId: null,
  justification: "Need it.",
  metadata: {
    stepCandidates: { "1": ["u-mgr", "u-alt"] },
    candidateIds: ["u-mgr", "u-alt"],
  },
  requester,
  category: { id: "cat-1", name: "Design" },
  costCenter: null,
  policy: { id: "p1", name: "Default" },
  catalog: null,
  steps: [
    {
      id: "s1",
      stepOrder: 1,
      label: "Manager",
      status: "PENDING",
      approverId: "u-mgr",
      approver,
      comment: null,
      dueAt: null,
      decidedAt: null,
    },
  ],
  events: [
    {
      id: "e1",
      type: "SUBMITTED",
      comment: null,
      metadata: null,
      createdAt: new Date("2026-03-01T00:00:00Z"),
      actor: requester,
    },
  ],
};

function ctx(userId: string, perms: string[], role = "MEMBER") {
  return { organizationId: "org", userId, role, permissions: new Set(perms) };
}

beforeEach(() => {
  vi.resetAllMocks();
  prisma.approvalRequest.findMany.mockResolvedValue([row]);
  prisma.approvalRequest.count.mockResolvedValue(1);
  prisma.user.findMany.mockResolvedValue([
    approver,
    { id: "u-alt", name: "Alt", email: "a@acme.test", image: null },
  ]);
});

describe("getApprovalRequests", () => {
  it("scopes 'to review' to the current approver and defaults to PENDING", async () => {
    requirePermission.mockResolvedValue(ctx("u-mgr", ["approvals:read"]));
    const res = await getApprovalRequests({ tab: "to_review" });
    expect(res.success).toBe(true);
    const where = prisma.approvalRequest.findMany.mock.calls[0][0].where;
    expect(where.status).toBe("PENDING");
    expect(where.OR).toEqual([
      { steps: { some: { approverId: "u-mgr", status: "PENDING" } } },
      { metadata: { path: ["candidateIds"], array_contains: ["u-mgr"] } },
    ]);
    expect(res.data?.items[0]).toMatchObject({
      id: "req-1",
      isAwaitingMe: true,
      totalSteps: 1,
      monthlyAmount: 100,
    });
    expect(res.data?.counts.all).toBeNull();
  });

  it("falls back to 'mine' when 'all' is requested without approvals:read_all", async () => {
    requirePermission.mockResolvedValue(ctx("u-req", ["approvals:read"]));
    const res = await getApprovalRequests({ tab: "all" });
    expect(res.data?.tab).toBe("mine");
    expect(
      prisma.approvalRequest.findMany.mock.calls[0][0].where.requesterId
    ).toBe("u-req");
  });

  it("applies filters, sort and pagination for read_all users", async () => {
    requirePermission.mockResolvedValue(
      ctx("admin", ["approvals:read", "approvals:read_all"], "ADMIN")
    );
    const res = await getApprovalRequests({
      tab: "all",
      status: "APPROVED",
      categoryId: "cat-1",
      requesterId: "u-req",
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
      search: "fig",
      sortBy: "monthlyAmount",
      sortOrder: "asc",
      page: 2,
      limit: 10,
    });
    expect(res.success).toBe(true);
    const args = prisma.approvalRequest.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({
      organizationId: "org",
      status: "APPROVED",
      categoryId: "cat-1",
      requesterId: "u-req",
      serviceName: { contains: "fig", mode: "insensitive" },
    });
    expect(args.where.submittedAt.gte).toBeInstanceOf(Date);
    expect(args.orderBy).toEqual({ monthlyAmount: "asc" });
    expect(args.skip).toBe(10);
    expect(args.take).toBe(10);
    expect(res.data?.counts.all).toBe(1);
  });

  it("returns field errors for invalid filters", async () => {
    requirePermission.mockResolvedValue(ctx("u", ["approvals:read"]));
    const res = await getApprovalRequests({ status: "BOGUS" });
    expect(res.success).toBe(false);
    expect(res.errors?.status).toBeDefined();
  });
});

describe("getApprovalRequest", () => {
  it("returns the detail with viewer flags for the current approver", async () => {
    requirePermission.mockResolvedValue(
      ctx("u-alt", ["approvals:read", "approvals:decide"])
    );
    prisma.approvalRequest.findFirst.mockResolvedValue(row);
    const res = await getApprovalRequest("req-1");
    expect(res.success).toBe(true);
    expect(res.data?.viewer).toEqual({
      canDecide: true,
      canProvideInfo: false,
      canCancel: false,
      canComment: true,
      isRequester: false,
    });
    expect(res.data?.steps[0].candidates.map((c) => c.id)).toEqual([
      "u-mgr",
      "u-alt",
    ]);
    expect(res.data?.events[0]).toMatchObject({
      type: "SUBMITTED",
      actor: requester,
    });
  });

  it("gives the requester cancel rights but no decision rights", async () => {
    requirePermission.mockResolvedValue(
      ctx("u-req", ["approvals:read", "approvals:decide"])
    );
    prisma.approvalRequest.findFirst.mockResolvedValue(row);
    const res = await getApprovalRequest("req-1");
    expect(res.data?.viewer).toMatchObject({
      canDecide: false,
      canCancel: true,
      isRequester: true,
    });
  });

  it("denies outsiders and reports missing requests", async () => {
    requirePermission.mockResolvedValue(ctx("stranger", ["approvals:read"]));
    prisma.approvalRequest.findFirst.mockResolvedValue(row);
    expect((await getApprovalRequest("req-1")).success).toBe(false);
    prisma.approvalRequest.findFirst.mockResolvedValue(null);
    expect((await getApprovalRequest("nope")).error).toBe(
      "Approval request not found"
    );
  });
});
