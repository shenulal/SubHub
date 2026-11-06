// src/lib/services/approval/decision-capture.test.ts
/**
 * Decision capture through the approve / reject services: conditions, cost
 * centre / category assignment, effective start date and rejection reasons
 * are validated against the organisation, persisted, audited and notified.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { approveRequest, rejectRequest } from "./decision";
import {
  approveRequestColumns,
  parseDateOnly,
  toApproveCapture,
} from "./decision-capture";

const prisma = vi.hoisted(() => ({
  approvalRequest: { findFirst: vi.fn(), update: vi.fn() },
  approvalStep: { update: vi.fn() },
  approvalEvent: { create: vi.fn() },
  auditLog: { create: vi.fn() },
  app: { findFirst: vi.fn(), create: vi.fn() },
  subscription: { create: vi.fn() },
  billingCycleConfig: { findMany: vi.fn() },
  costCenter: { findFirst: vi.fn() },
  category: { findFirst: vi.fn() },
  approvalRejectionReason: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}));
const notify = vi.hoisted(() => vi.fn());
const settings = vi.hoisted(() => ({
  "approvals.autoCreateSubscription": true,
  "approvals.defaultReminderAfterDays": 2,
  "subscriptions.defaultReminderLeadDays": [7],
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

const NOW = new Date("2026-11-06T08:00:00Z");
const approver = {
  userId: "qa-approver",
  role: "APPROVER",
  permissions: new Set(["approvals:decide"]),
};

function singleStepRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: "req-1",
    organizationId: "org",
    requesterId: "qa-member",
    policyId: "p1",
    catalogId: null,
    categoryId: null,
    costCenterId: null,
    subscriptionId: null,
    serviceName: "Miro <Team>",
    vendorWebsite: null,
    amount: 120,
    currency: "AED",
    billingCycle: "MONTHLY",
    monthlyAmount: 120,
    seats: 3,
    justification: "Workshops with clients need a shared board.",
    status: "PENDING",
    currentStep: 1,
    submittedAt: NOW,
    decidedAt: null,
    decisionConditions: null,
    effectiveStartDate: null,
    metadata: { stepCandidates: { "1": ["qa-approver"] }, candidateIds: [] },
    policy: { id: "p1", reminderAfterDays: 2, escalationAfterDays: null },
    requester: { id: "qa-member", name: "QA Member", email: "m@qa.test" },
    steps: [
      {
        id: "s1",
        stepOrder: 1,
        label: "QA approver",
        approverId: "qa-approver",
        status: "PENDING",
        updatedAt: NOW,
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  prisma.$transaction.mockImplementation(
    async (fn: (tx: typeof prisma) => unknown) => fn(prisma)
  );
  prisma.billingCycleConfig.findMany.mockResolvedValue([
    { cycle: "MONTHLY", months: 1 },
  ]);
  prisma.app.findFirst.mockResolvedValue(null);
  prisma.app.create.mockResolvedValue({ id: "app-1" });
  prisma.subscription.create.mockResolvedValue({ id: "sub-1" });
});

describe("approve with decision capture", () => {
  it("assigns cost centre and category, stores conditions, starts the subscription on the agreed date", async () => {
    prisma.approvalRequest.findFirst.mockResolvedValue(singleStepRequest());
    prisma.costCenter.findFirst.mockResolvedValue({
      id: "cc-1",
      code: "MKT",
      name: "Marketing",
    });
    prisma.category.findFirst.mockResolvedValue({
      id: "cat-1",
      name: "Design",
    });

    const result = await approveRequest(
      "org",
      approver,
      "req-1",
      {
        comment: "Approved for Q1",
        conditions: "Annual plan after the trial",
        costCenterId: "cc-1",
        categoryId: "cat-1",
        effectiveStartDate: parseDateOnly("2026-12-01"),
      },
      NOW
    );

    expect(result).toMatchObject({
      status: "APPROVED",
      subscriptionId: "sub-1",
    });
    expect(prisma.costCenter.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cc-1", organizationId: "org", isActive: true },
      })
    );
    expect(prisma.approvalRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "APPROVED",
          decisionComment: "Approved for Q1",
          decisionConditions: "Annual plan after the trial",
          costCenterId: "cc-1",
          categoryId: "cat-1",
          effectiveStartDate: new Date("2026-12-01T00:00:00Z"),
        }),
      })
    );
    expect(prisma.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          startDate: new Date("2026-12-01T00:00:00Z"),
          renewalDate: new Date("2027-01-01T00:00:00Z"),
          costCenterId: "cc-1",
          categoryId: "cat-1",
        }),
      })
    );
    const audit = prisma.auditLog.create.mock.calls.find(
      ([arg]) => arg.data.action === "APPROVAL_REQUEST_APPROVED"
    )?.[0];
    expect(audit?.data.changes).toMatchObject({
      comment: "Approved for Q1",
      conditions: "Annual plan after the trial",
      effectiveStartDate: "2026-12-01",
      costCenter: { from: null, to: "cc-1", label: "MKT · Marketing" },
      category: { from: null, to: "cat-1", label: "Design" },
    });
    const sent = notify.mock.calls[0][0];
    expect(sent.body).toContain("Conditions: Annual plan after the trial");
    expect(sent.body).toContain("Subscription starts on 2026-12-01");
    // User text is escaped in the email body.
    expect(sent.email.html).toContain("Miro &lt;Team&gt;");
  });

  it("refuses a cost centre from another organisation (or inactive)", async () => {
    prisma.approvalRequest.findFirst.mockResolvedValue(singleStepRequest());
    prisma.costCenter.findFirst.mockResolvedValue(null);
    await expect(
      approveRequest("org", approver, "req-1", { costCenterId: "x" }, NOW)
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(prisma.approvalStep.update).not.toHaveBeenCalled();
  });

  it("accumulates conditions across a multi-step chain with step labels", () => {
    const columns = approveRequestColumns(
      {
        decisionConditions: "Manager: Pilot with 3 seats",
        steps: [{}, {}] as never,
      },
      {
        comment: null,
        conditions: "Pay annually",
        costCenterId: null,
        categoryId: null,
        effectiveStartDate: null,
        costCenter: null,
        category: null,
      },
      "Finance"
    );
    expect(columns.decisionConditions).toBe(
      "Manager: Pilot with 3 seats\nFinance: Pay annually"
    );
  });

  it("keeps the legacy comment-only call working", () => {
    expect(toApproveCapture(" fine ")).toEqual({
      comment: "fine",
      conditions: null,
      costCenterId: null,
      categoryId: null,
      effectiveStartDate: null,
    });
  });
});

describe("reject with a reason", () => {
  it("stores the reason (id + name snapshot) and tells the requester", async () => {
    prisma.approvalRequest.findFirst.mockResolvedValue(singleStepRequest());
    prisma.approvalRejectionReason.findFirst.mockResolvedValue({
      id: "r-budget",
      name: "No budget available",
    });
    await rejectRequest(
      "org",
      approver,
      "req-1",
      { reasonId: "r-budget", comment: "Try again next quarter" },
      NOW
    );
    expect(prisma.approvalRejectionReason.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "r-budget", organizationId: "org", isActive: true },
      })
    );
    expect(prisma.approvalRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "REJECTED",
          rejectionReasonId: "r-budget",
          rejectionReasonName: "No budget available",
          decisionComment: "Try again next quarter",
        }),
      })
    );
    expect(prisma.approvalEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "REJECTED",
          metadata: expect.objectContaining({
            reason: { id: "r-budget", name: "No budget available" },
          }),
        }),
      })
    );
    const sent = notify.mock.calls[0][0];
    expect(sent.body).toContain("Reason: No budget available");
    expect(sent.body).toContain("Reviewer comment: Try again next quarter");
    expect(sent.metadata).toMatchObject({ reason: "No budget available" });
  });

  it("rejects an unknown or inactive reason and an empty comment", async () => {
    prisma.approvalRequest.findFirst.mockResolvedValue(singleStepRequest());
    prisma.approvalRejectionReason.findFirst.mockResolvedValue(null);
    await expect(
      rejectRequest("org", approver, "req-1", {
        reasonId: "gone",
        comment: "x",
      })
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      rejectRequest("org", approver, "req-1", { reasonId: null, comment: " " })
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(prisma.approvalStep.update).not.toHaveBeenCalled();
  });
});
