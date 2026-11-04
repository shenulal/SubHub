// src/actions/discovery/saved-views.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ALL_READ,
  FakeForbidden,
  ORG,
  permissionResult,
  USER,
} from "./test-helpers";

const { prisma, requirePermission } = vi.hoisted(() => {
  const prisma = {
    subscription: { findMany: vi.fn(), count: vi.fn() },
    savedView: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
    approvalRequest: { findMany: vi.fn() },
    saaSCatalog: { findMany: vi.fn() },
    category: { findMany: vi.fn() },
    tag: { findMany: vi.fn() },
    team: { findMany: vi.fn() },
    costCenter: { findMany: vi.fn() },
    paymentMethodOption: { findMany: vi.fn() },
    billingCycleConfig: { findMany: vi.fn() },
  };
  const requirePermission = vi.fn();
  return { prisma, requirePermission };
});

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/rbac/service", () => ({
  requirePermission: (...args: unknown[]) => requirePermission(...args),
  isForbiddenError: (e: unknown) => e instanceof FakeForbidden,
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
  createSavedView,
  deleteSavedView,
  listSavedViews,
  setDefaultView,
  updateSavedView,
} from "./saved-views";

const row = {
  id: "v1",
  organizationId: ORG,
  userId: USER,
  entity: "subscriptions",
  name: "Mine",
  filters: { statuses: ["ACTIVE"], tagIds: ["t1"] },
  sort: { sortBy: "amount", sortOrder: "desc" },
  isShared: false,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-02"),
};

describe("saved views", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermission.mockResolvedValue(permissionResult(ALL_READ));
    prisma.user.findUnique.mockResolvedValue({
      preferences: { defaultViews: { subscriptions: "v1" } },
    });
    prisma.auditLog.create.mockResolvedValue({});
  });

  it("lists own and shared views with default flag and validated filters", async () => {
    prisma.savedView.findMany.mockResolvedValue([
      row,
      {
        ...row,
        id: "v2",
        userId: "someone-else",
        isShared: true,
        filters: { bogus: true },
        sort: null,
      },
    ]);
    const result = await listSavedViews("subscriptions");
    expect(result.success).toBe(true);
    expect(prisma.savedView.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: ORG,
          entity: "subscriptions",
          OR: [{ userId: USER }, { isShared: true }],
        },
      })
    );
    const [mine, shared] = result.data!;
    expect(mine).toMatchObject({
      id: "v1",
      isOwner: true,
      isDefault: true,
      filters: { statuses: ["ACTIVE"], tagIds: ["t1"] },
    });
    expect(shared).toMatchObject({
      id: "v2",
      isOwner: false,
      isShared: true,
      filters: {},
      sort: null,
    });
  });

  it("rejects invalid input via zod", async () => {
    const result = await createSavedView({
      name: "",
      filters: { amountMin: 10, amountMax: 1 },
    });
    expect(result.success).toBe(false);
    expect(prisma.savedView.upsert).not.toHaveBeenCalled();
  });

  it("creates a private view, audits it and revalidates", async () => {
    prisma.savedView.upsert.mockResolvedValue(row);
    const result = await createSavedView({
      name: "Mine",
      filters: { statuses: ["ACTIVE"] },
      sort: { sortBy: "amount", sortOrder: "desc" },
    });
    expect(result.success).toBe(true);
    expect(prisma.savedView.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_entity_name: {
            userId: USER,
            entity: "subscriptions",
            name: "Mine",
          },
        },
      })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "CREATE_SAVED_VIEW",
          entityId: "v1",
          organizationId: ORG,
        }),
      })
    );
  });

  it("requires read_all to share a view", async () => {
    requirePermission
      .mockResolvedValueOnce(permissionResult(["subscriptions:read"]))
      .mockRejectedValueOnce(new FakeForbidden("subscriptions:read_all"));
    const result = await createSavedView({
      name: "Team",
      filters: {},
      isShared: true,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/permission/);
    expect(prisma.savedView.upsert).not.toHaveBeenCalled();
  });

  it("only lets owners edit private views", async () => {
    prisma.savedView.findFirst.mockResolvedValue({ ...row, userId: "other" });
    const result = await updateSavedView({ id: "v1", name: "Renamed" });
    expect(result.success).toBe(false);
    expect(prisma.savedView.update).not.toHaveBeenCalled();
  });

  it("updates a view with new filters", async () => {
    prisma.savedView.findFirst.mockResolvedValue(row);
    prisma.savedView.update.mockResolvedValue({ ...row, name: "Renamed" });
    const result = await updateSavedView({
      id: "v1",
      name: "Renamed",
      filters: { search: "x" },
    });
    expect(result.success).toBe(true);
    expect(result.data?.name).toBe("Renamed");
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "UPDATE_SAVED_VIEW" }),
      })
    );
  });

  it("deletes own views and refuses other people's private views", async () => {
    prisma.savedView.findFirst.mockResolvedValueOnce(row);
    expect((await deleteSavedView("v1")).success).toBe(true);
    expect(prisma.savedView.delete).toHaveBeenCalledWith({
      where: { id: "v1" },
    });

    prisma.savedView.findFirst.mockResolvedValueOnce({
      ...row,
      userId: "other",
    });
    expect((await deleteSavedView("v1")).success).toBe(false);
  });

  it("stores and clears the default view in user preferences", async () => {
    prisma.savedView.findFirst.mockResolvedValue({ id: "v1" });
    prisma.user.findUnique.mockResolvedValue({
      preferences: { scope: "personal" },
    });
    expect((await setDefaultView("v1")).success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: USER },
      data: {
        preferences: {
          scope: "personal",
          defaultViews: { subscriptions: "v1" },
        },
      },
    });

    prisma.user.findUnique.mockResolvedValue({
      preferences: { defaultViews: { subscriptions: "v1" } },
    });
    expect((await setDefaultView(null)).success).toBe(true);
    expect(prisma.user.update).toHaveBeenLastCalledWith({
      where: { id: USER },
      data: { preferences: { defaultViews: {} } },
    });
  });

  it("returns an error when the default view is not visible to the user", async () => {
    prisma.savedView.findFirst.mockResolvedValue(null);
    const result = await setDefaultView("ghost");
    expect(result).toEqual({ success: false, error: "View not found" });
  });
});
