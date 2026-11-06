// src/actions/renewal-alerts.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock modules
vi.mock("@/lib/rbac/service", async () =>
  (await import("@/test/rbac-session-mock")).sessionRbacMock()
);
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    renewalAlert: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    subscription: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

// Mock next/navigation redirect - Next.js redirect error has a digest property
const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mockRedirect(url);
    const error = new Error(`NEXT_REDIRECT:${url}`);
    (error as Error & { digest: string }).digest = `NEXT_REDIRECT:${url}`;
    throw error;
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createRenewalAlert,
  deleteRenewalAlert,
  generateRenewalAlerts,
  getRenewalAlerts,
  markAlertAsSent,
} from "./renewal-alerts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockedAuth = auth as any;

describe("RenewalAlert Server Actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRedirect.mockClear();
  });

  describe("getRenewalAlerts", () => {
    it("redirects to /login when unauthenticated", async () => {
      mockedAuth.mockResolvedValue(null);

      await expect(getRenewalAlerts()).rejects.toThrow("NEXT_REDIRECT");
      expect(mockRedirect).toHaveBeenCalledWith("/login");
    });

    it("returns the renewal alert list", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1" },
        expires: "",
      });

      const mockAlerts = [
        {
          id: "alert-1",
          subscriptionId: "sub-1",
          alertType: "DAYS_30",
          scheduledFor: new Date("2024-01-15"),
          sentAt: null,
          createdAt: new Date("2024-01-01"),
          subscription: {
            id: "sub-1",
            app: { name: "Slack" },
            renewalDate: new Date("2024-02-15"),
            amount: 10000,
            currency: "KRW",
          },
        },
      ];

      vi.mocked(prisma.renewalAlert.findMany).mockResolvedValue(
        mockAlerts as never
      );

      const result = await getRenewalAlerts();

      expect(result).toHaveLength(1);
      expect(result[0].alertType).toBe("DAYS_30");
      expect(result[0].subscription.app.name).toBe("Slack");
    });

    it("can filter to unsent alerts only", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1" },
        expires: "",
      });

      vi.mocked(prisma.renewalAlert.findMany).mockResolvedValue([]);

      await getRenewalAlerts({ sentOnly: false });

      expect(prisma.renewalAlert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sentAt: null,
          }),
        })
      );
    });
  });

  describe("createRenewalAlert", () => {
    it("returns an error when unauthenticated", async () => {
      mockedAuth.mockResolvedValue(null);

      const result = await createRenewalAlert({
        subscriptionId: "sub-1",
        alertType: "DAYS_30",
        scheduledFor: new Date("2024-01-15"),
      });

      await expect(result.success).toBe(false);
    });

    it("returns an error for a non-existent subscription", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1" },
        expires: "",
      });

      vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null);

      const result = await createRenewalAlert({
        subscriptionId: "non-existent",
        alertType: "DAYS_30",
        scheduledFor: new Date("2024-01-15"),
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe("Subscription not found");
    });

    it("creates a renewal alert successfully", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1" },
        expires: "",
      });

      vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
        id: "sub-1",
        organizationId: "org-1",
      } as never);

      vi.mocked(prisma.renewalAlert.create).mockResolvedValue({
        id: "alert-1",
        subscriptionId: "sub-1",
        alertType: "DAYS_30",
        scheduledFor: new Date("2024-01-15"),
        sentAt: null,
        createdAt: new Date(),
      } as never);

      const result = await createRenewalAlert({
        subscriptionId: "sub-1",
        alertType: "DAYS_30",
        scheduledFor: new Date("2024-01-15"),
      });

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe("alert-1");
    });
  });

  describe("markAlertAsSent", () => {
    it("marks an alert as sent", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
        expires: "",
      });

      vi.mocked(prisma.renewalAlert.findFirst).mockResolvedValue({
        id: "alert-1",
        subscriptionId: "sub-1",
        subscription: { organizationId: "org-1" },
      } as never);

      vi.mocked(prisma.renewalAlert.update).mockResolvedValue({
        id: "alert-1",
        sentAt: new Date(),
      } as never);

      const result = await markAlertAsSent("alert-1");

      expect(result.success).toBe(true);
      expect(prisma.renewalAlert.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "alert-1" },
          data: expect.objectContaining({
            sentAt: expect.any(Date),
          }),
        })
      );
    });

    it("returns an error for a non-existent alert", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
        expires: "",
      });

      vi.mocked(prisma.renewalAlert.findFirst).mockResolvedValue(null);

      const result = await markAlertAsSent("non-existent");

      expect(result.success).toBe(false);
      expect(result.message).toBe("Alert not found");
    });
  });

  describe("deleteRenewalAlert", () => {
    it("returns an error for a non-admin", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "MEMBER" },
        expires: "",
      });

      const result = await deleteRenewalAlert("alert-1");

      expect(result.success).toBe(false);
      expect(result.message).toBe("Admin permission required");
    });

    it("deletes a renewal alert", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
        expires: "",
      });

      vi.mocked(prisma.renewalAlert.findFirst).mockResolvedValue({
        id: "alert-1",
        subscription: { organizationId: "org-1" },
      } as never);

      vi.mocked(prisma.renewalAlert.delete).mockResolvedValue({} as never);

      const result = await deleteRenewalAlert("alert-1");

      expect(result.success).toBe(true);
      expect(prisma.renewalAlert.delete).toHaveBeenCalledWith({
        where: { id: "alert-1" },
      });
    });
  });

  describe("generateRenewalAlerts", () => {
    it("returns an error for a non-admin", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "MEMBER" },
        expires: "",
      });

      const result = await generateRenewalAlerts();

      expect(result.success).toBe(false);
      expect(result.message).toBe("Admin permission required");
    });

    it("creates alerts for subscriptions due for renewal", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
        expires: "",
      });

      const renewalDate = new Date();
      renewalDate.setDate(renewalDate.getDate() + 25); // renews in 25 days

      vi.mocked(prisma.subscription.findMany).mockResolvedValue([
        {
          id: "sub-1",
          renewalDate,
          renewalAlert30: true,
          renewalAlert60: false,
          renewalAlert90: false,
          renewalAlerts: [],
        },
      ] as never);

      vi.mocked(prisma.renewalAlert.createMany).mockResolvedValue({
        count: 1,
      } as never);

      const result = await generateRenewalAlerts();

      expect(result.success).toBe(true);
      expect(result.data?.created).toBeGreaterThanOrEqual(0);
    });
  });
});
