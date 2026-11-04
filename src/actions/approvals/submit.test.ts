// src/actions/approvals/submit.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { submitApprovalRequest } from "./submit";

const requirePermission = vi.hoisted(() => vi.fn());
const service = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/rbac/service", () => ({
  requirePermission,
  isForbiddenError: (e: unknown) => (e as Error)?.name === "ForbiddenError",
}));
vi.mock("@/lib/settings/service", () => ({
  getSettings: vi.fn(async () => ({
    "approvals.justificationMinLength": 20,
    "finance.enabledCurrencies": ["AED", "USD"],
  })),
  getSetting: vi.fn(),
}));
vi.mock("@/lib/services/approval/submit", () => ({
  submitApprovalRequest: service,
}));

const valid = {
  serviceName: "Figma",
  vendorWebsite: "https://figma.com",
  amount: "1200",
  currency: "aed",
  billingCycle: "YEARLY",
  seats: "3",
  categoryId: "cat-1",
  costCenterId: "",
  justification: "Design tooling for the whole product squad.",
};

beforeEach(() => {
  vi.resetAllMocks();
  requirePermission.mockResolvedValue({
    organizationId: "org",
    userId: "u-req",
    role: "MEMBER",
    permissions: new Set(),
  });
});

describe("submitApprovalRequest action", () => {
  it("validates with settings-driven rules and forwards normalised data", async () => {
    service.mockResolvedValue({
      id: "req-1",
      status: "PENDING",
      autoApproved: false,
      policyId: "p1",
    });
    const res = await submitApprovalRequest(valid);
    expect(requirePermission).toHaveBeenCalledWith("approvals:create");
    expect(service).toHaveBeenCalledWith({
      organizationId: "org",
      requesterId: "u-req",
      data: expect.objectContaining({
        amount: 1200,
        currency: "AED",
        seats: 3,
        costCenterId: null,
        catalogId: null,
      }),
    });
    expect(res).toEqual({
      success: true,
      data: { id: "req-1", status: "PENDING", autoApproved: false },
    });
  });

  it("rejects short justifications and unsupported currencies with field errors", async () => {
    const res = await submitApprovalRequest({
      ...valid,
      justification: "too short",
      currency: "JPY",
    });
    expect(res.success).toBe(false);
    expect(res.errors?.justification).toBeDefined();
    expect(res.errors?.currency).toBeDefined();
    expect(service).not.toHaveBeenCalled();
  });
});
