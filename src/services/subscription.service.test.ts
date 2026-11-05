// src/services/subscription.service.test.ts
// TDD RED → GREEN: Subscription service layer tests
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/fx/base-currency", () => ({
  getBaseCurrency: vi.fn().mockResolvedValue("KRW"),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    app: {
      findFirst: vi.fn(),
    },
    subscription: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import {
  createSubscription,
  deleteSubscription,
  updateSubscription,
  type SubscriptionServiceContext,
} from "./subscription.service";

const mockCtx: SubscriptionServiceContext = {
  organizationId: "org-1",
  userId: "user-1",
  role: "ADMIN",
};

describe("SubscriptionService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ==================== createSubscription ====================
  describe("createSubscription", () => {
    it("creates a subscription successfully", async () => {
      vi.mocked(prisma.app.findFirst).mockResolvedValue({
        id: "app-1",
        name: "Slack",
        organizationId: "org-1",
      } as never);
      vi.mocked(prisma.subscription.create).mockResolvedValue({
        id: "sub-new",
        appId: "app-1",
      } as never);

      const result = await createSubscription(mockCtx, {
        appId: "app-1",
        billingCycle: "MONTHLY",
        amount: "20000",
        startDate: "2026-04-01",
      });

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe("sub-new");
      expect(prisma.subscription.create).toHaveBeenCalledOnce();
      expect(prisma.auditLog.create).toHaveBeenCalledOnce();
    });

    it("fails when the app does not exist", async () => {
      vi.mocked(prisma.app.findFirst).mockResolvedValue(null);

      const result = await createSubscription(mockCtx, {
        appId: "nonexistent",
        billingCycle: "MONTHLY",
        amount: "20000",
        startDate: "2026-04-01",
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("App not found");
    });

    it("fails for a VIEWER role", async () => {
      const viewerCtx = { ...mockCtx, role: "VIEWER" };

      const result = await createSubscription(viewerCtx, {
        appId: "app-1",
        billingCycle: "MONTHLY",
        amount: "20000",
        startDate: "2026-04-01",
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("permission");
    });

    it("creates with optional fields included", async () => {
      vi.mocked(prisma.app.findFirst).mockResolvedValue({
        id: "app-1",
        name: "Slack",
        organizationId: "org-1",
      } as never);
      vi.mocked(prisma.subscription.create).mockResolvedValue({
        id: "sub-new",
        appId: "app-1",
      } as never);

      const result = await createSubscription(mockCtx, {
        appId: "app-1",
        billingCycle: "YEARLY",
        billingType: "PER_SEAT",
        amount: "240000",
        currency: "USD",
        startDate: "2026-04-01",
        endDate: "2027-03-31",
        totalLicenses: 50,
        autoRenewal: false,
        notes: "Annual contract",
      });

      expect(result.success).toBe(true);
      expect(prisma.subscription.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            billingCycle: "YEARLY",
            billingType: "PER_SEAT",
            amount: 240000,
            currency: "USD",
            totalLicenses: 50,
            autoRenewal: false,
            notes: "Annual contract",
          }),
        })
      );
    });
  });

  // ==================== updateSubscription ====================
  describe("updateSubscription", () => {
    it("updates a subscription successfully", async () => {
      vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
        id: "sub-1",
        appId: "app-1",
        status: "ACTIVE",
        billingCycle: "MONTHLY",
        billingType: "FLAT_RATE",
        amount: 20000,
        currency: "KRW",
        organizationId: "org-1",
      } as never);
      vi.mocked(prisma.subscription.update).mockResolvedValue({
        id: "sub-1",
        amount: 25000,
      } as never);

      const result = await updateSubscription(mockCtx, "sub-1", {
        amount: "25000",
      });

      expect(result.success).toBe(true);
      expect(prisma.subscription.update).toHaveBeenCalledOnce();
    });

    it("fails when the subscription does not exist", async () => {
      vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null);

      const result = await updateSubscription(mockCtx, "nonexistent", {
        amount: "25000",
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("not found");
    });

    it("fails when the user is not an ADMIN", async () => {
      const memberCtx = { ...mockCtx, role: "MEMBER" };

      const result = await updateSubscription(memberCtx, "sub-1", {
        amount: "25000",
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("permission");
    });

    it("allows changing the status", async () => {
      vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
        id: "sub-1",
        appId: "app-1",
        status: "ACTIVE",
        organizationId: "org-1",
      } as never);
      vi.mocked(prisma.subscription.update).mockResolvedValue({
        id: "sub-1",
        status: "CANCELLED",
      } as never);

      const result = await updateSubscription(mockCtx, "sub-1", {
        status: "CANCELLED",
      });

      expect(result.success).toBe(true);
      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "CANCELLED",
          }),
        })
      );
    });
  });

  // ==================== deleteSubscription ====================
  describe("deleteSubscription", () => {
    it("deletes a subscription successfully", async () => {
      vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
        id: "sub-1",
        organizationId: "org-1",
        app: { name: "Slack" },
      } as never);

      const result = await deleteSubscription(mockCtx, "sub-1");

      expect(result.success).toBe(true);
      expect(prisma.subscription.delete).toHaveBeenCalledWith({
        where: { id: "sub-1" },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledOnce();
    });

    it("fails when the subscription does not exist", async () => {
      vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null);

      const result = await deleteSubscription(mockCtx, "nonexistent");

      expect(result.success).toBe(false);
      expect(result.message).toContain("not found");
    });

    it("fails when the user is not an ADMIN", async () => {
      const memberCtx = { ...mockCtx, role: "MEMBER" };

      const result = await deleteSubscription(memberCtx, "sub-1");

      expect(result.success).toBe(false);
      expect(result.message).toContain("permission");
    });
  });
});
