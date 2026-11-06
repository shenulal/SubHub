// src/actions/platform/masters/rejection-reasons.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createRejectionReason,
  deleteRejectionReason,
  listRejectionReasons,
  updateRejectionReason,
} from "./rejection-reasons";

const requirePermission = vi.hoisted(() => vi.fn());
const prisma = vi.hoisted(() => ({
  approvalRejectionReason: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  auditLog: { create: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/rbac/service", () => ({
  requirePermission,
  isForbiddenError: (e: unknown) => (e as Error)?.name === "ForbiddenError",
}));
vi.mock("@/lib/settings/service", () => ({
  SettingValidationError: class extends Error {},
}));

const admin = { organizationId: "org", userId: "admin" };

beforeEach(() => {
  vi.resetAllMocks();
  requirePermission.mockResolvedValue(admin);
});

describe("rejection reasons master", () => {
  it("lists with masters:read and maps usage counts", async () => {
    prisma.approvalRejectionReason.findMany.mockResolvedValue([
      {
        id: "r1",
        code: "BUDGET",
        name: "No budget",
        description: null,
        sortOrder: 0,
        isActive: true,
        _count: { requests: 2 },
      },
    ]);
    const res = await listRejectionReasons();
    expect(requirePermission).toHaveBeenCalledWith("masters:read");
    expect(res.data?.[0]).toMatchObject({ code: "BUDGET", usageCount: 2 });
  });

  it("denies changes without masters:manage", async () => {
    const error = new Error("Missing masters:manage");
    error.name = "ForbiddenError";
    requirePermission.mockRejectedValue(error);
    const res = await createRejectionReason({ code: "X", name: "X" });
    expect(res.success).toBe(false);
    expect(prisma.approvalRejectionReason.create).not.toHaveBeenCalled();
  });

  it("creates a reason (code normalised to upper case) and audits it", async () => {
    prisma.approvalRejectionReason.findFirst.mockResolvedValue(null);
    prisma.approvalRejectionReason.create.mockResolvedValue({
      id: "r2",
      name: "Vendor risk",
    });
    const res = await createRejectionReason({
      code: "vendor_risk",
      name: "Vendor risk",
    });
    expect(requirePermission).toHaveBeenCalledWith("masters:manage");
    expect(res).toMatchObject({ success: true, data: { id: "r2" } });
    expect(prisma.approvalRejectionReason.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "org",
          code: "VENDOR_RISK",
          isActive: true,
        }),
      })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "CREATE_REJECTION_REASON" }),
      })
    );
  });

  it("refuses a duplicate code and invalid input", async () => {
    prisma.approvalRejectionReason.findFirst.mockResolvedValue({ id: "other" });
    const dup = await createRejectionReason({ code: "BUDGET", name: "Budget" });
    expect(dup).toMatchObject({ success: false });
    const invalid = await createRejectionReason({
      code: "has space",
      name: "",
    });
    expect(invalid.success).toBe(false);
    expect(invalid.errors).toBeDefined();
  });

  it("updates only reasons of the caller's organisation", async () => {
    prisma.approvalRejectionReason.findFirst.mockResolvedValueOnce(null);
    const missing = await updateRejectionReason("foreign", {
      code: "X",
      name: "X",
    });
    expect(missing).toMatchObject({ success: false });
    expect(prisma.approvalRejectionReason.findFirst).toHaveBeenCalledWith({
      where: { id: "foreign", organizationId: "org" },
    });
    expect(prisma.approvalRejectionReason.update).not.toHaveBeenCalled();
  });

  it("deactivates a reason that earlier decisions used, deletes an unused one", async () => {
    prisma.approvalRejectionReason.findFirst.mockResolvedValueOnce({
      id: "r1",
      code: "BUDGET",
      name: "No budget",
      _count: { requests: 3 },
    });
    const used = await deleteRejectionReason("r1");
    expect(prisma.approvalRejectionReason.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: { isActive: false },
    });
    expect(used.message).toMatch(/deactivated/);

    prisma.approvalRejectionReason.findFirst.mockResolvedValueOnce({
      id: "r9",
      code: "OTHER",
      name: "Other",
      _count: { requests: 0 },
    });
    await deleteRejectionReason("r9");
    expect(prisma.approvalRejectionReason.delete).toHaveBeenCalledWith({
      where: { id: "r9" },
    });
  });
});
