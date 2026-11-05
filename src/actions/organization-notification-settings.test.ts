// src/actions/organization-notification-settings.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Mock Prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    organization: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock revalidatePath
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock next/navigation redirect
const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mockRedirect(url);
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockedAuth = auth as any;

describe("Organization Notification Settings Server Actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRedirect.mockClear();
  });

  describe("getOrganizationNotificationSettings", () => {
    it("redirects to login when unauthenticated", async () => {
      mockedAuth.mockResolvedValue(null);

      const { getOrganizationNotificationSettings } =
        await import("./organization-notification-settings");
      await expect(getOrganizationNotificationSettings()).rejects.toThrow(
        "NEXT_REDIRECT:/login"
      );
    });

    it("redirects a user without an organization ID to onboarding", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: null },
        expires: "",
      });

      const { getOrganizationNotificationSettings } =
        await import("./organization-notification-settings");
      await expect(getOrganizationNotificationSettings()).rejects.toThrow(
        "NEXT_REDIRECT:/onboarding"
      );
    });

    it("returns organization notification settings", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1" },
        expires: "",
      });

      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: "org-1",
        settings: {
          notifications: {
            emailEnabled: true,
            renewalAlertDays: [30, 60, 90],
            offboardingAlerts: true,
            weeklyDigest: false,
            shadowITAlerts: true,
            costAnomalyAlerts: true,
            costAnomalyThreshold: 50,
          },
        },
      } as never);

      const { getOrganizationNotificationSettings } =
        await import("./organization-notification-settings");
      const result = await getOrganizationNotificationSettings();

      expect(result).toEqual({
        emailEnabled: true,
        renewalAlertDays: [30, 60, 90],
        offboardingAlerts: true,
        weeklyDigest: false,
        shadowITAlerts: true,
        costAnomalyAlerts: true,
        costAnomalyThreshold: 50,
      });
    });

    it("returns defaults when there are no settings", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1" },
        expires: "",
      });

      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: "org-1",
        settings: {},
      } as never);

      const { getOrganizationNotificationSettings } =
        await import("./organization-notification-settings");
      const result = await getOrganizationNotificationSettings();

      expect(result).toEqual({
        emailEnabled: true,
        renewalAlertDays: [30],
        offboardingAlerts: true,
        weeklyDigest: false,
        shadowITAlerts: true,
        costAnomalyAlerts: true,
        costAnomalyThreshold: 50,
      });
    });

    it("returns defaults when there is no organization", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1" },
        expires: "",
      });

      vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);

      const { getOrganizationNotificationSettings } =
        await import("./organization-notification-settings");
      const result = await getOrganizationNotificationSettings();

      expect(result).toEqual({
        emailEnabled: true,
        renewalAlertDays: [30],
        offboardingAlerts: true,
        weeklyDigest: false,
        shadowITAlerts: true,
        costAnomalyAlerts: true,
        costAnomalyThreshold: 50,
      });
    });
  });

  describe("updateOrganizationNotificationSettings", () => {
    it("redirects to login when unauthenticated", async () => {
      mockedAuth.mockResolvedValue(null);

      const { updateOrganizationNotificationSettings } =
        await import("./organization-notification-settings");
      await expect(
        updateOrganizationNotificationSettings({ emailEnabled: true })
      ).rejects.toThrow("NEXT_REDIRECT:/login");
    });

    it("updates email notification settings", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
        expires: "",
      });

      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: "org-1",
        settings: {
          notifications: {
            emailEnabled: false,
            renewalAlertDays: [30],
            offboardingAlerts: true,
            weeklyDigest: false,
            shadowITAlerts: true,
            costAnomalyAlerts: true,
            costAnomalyThreshold: 50,
          },
        },
      } as never);

      vi.mocked(prisma.organization.update).mockResolvedValue({
        id: "org-1",
        settings: {
          notifications: {
            emailEnabled: true,
            renewalAlertDays: [30],
            offboardingAlerts: true,
            weeklyDigest: false,
            shadowITAlerts: true,
            costAnomalyAlerts: true,
            costAnomalyThreshold: 50,
          },
        },
      } as never);

      const { updateOrganizationNotificationSettings } =
        await import("./organization-notification-settings");
      const result = await updateOrganizationNotificationSettings({
        emailEnabled: true,
      });

      expect(result.success).toBe(true);
      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: "org-1" },
        data: {
          settings: {
            notifications: {
              emailEnabled: true,
              renewalAlertDays: [30],
              offboardingAlerts: true,
              weeklyDigest: false,
              shadowITAlerts: true,
              costAnomalyAlerts: true,
              costAnomalyThreshold: 50,
            },
          },
        },
      });
    });

    it("updates renewal alert days", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
        expires: "",
      });

      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: "org-1",
        settings: {
          notifications: {
            emailEnabled: true,
            renewalAlertDays: [30],
            offboardingAlerts: true,
            weeklyDigest: false,
            shadowITAlerts: true,
            costAnomalyAlerts: true,
            costAnomalyThreshold: 50,
          },
        },
      } as never);

      vi.mocked(prisma.organization.update).mockResolvedValue({
        id: "org-1",
        settings: {
          notifications: {
            emailEnabled: true,
            renewalAlertDays: [30, 60, 90],
            offboardingAlerts: true,
            weeklyDigest: false,
            shadowITAlerts: true,
            costAnomalyAlerts: true,
            costAnomalyThreshold: 50,
          },
        },
      } as never);

      const { updateOrganizationNotificationSettings } =
        await import("./organization-notification-settings");
      const result = await updateOrganizationNotificationSettings({
        renewalAlertDays: [30, 60, 90],
      });

      expect(result.success).toBe(true);
      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: "org-1" },
        data: {
          settings: {
            notifications: {
              emailEnabled: true,
              renewalAlertDays: [30, 60, 90],
              offboardingAlerts: true,
              weeklyDigest: false,
              shadowITAlerts: true,
              costAnomalyAlerts: true,
              costAnomalyThreshold: 50,
            },
          },
        },
      });
    });

    it("updates terminated-user alert settings", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
        expires: "",
      });

      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: "org-1",
        settings: {
          notifications: {
            emailEnabled: true,
            renewalAlertDays: [30],
            offboardingAlerts: true,
            weeklyDigest: false,
            shadowITAlerts: true,
            costAnomalyAlerts: true,
            costAnomalyThreshold: 50,
          },
        },
      } as never);

      vi.mocked(prisma.organization.update).mockResolvedValue({
        id: "org-1",
        settings: {
          notifications: {
            emailEnabled: true,
            renewalAlertDays: [30],
            offboardingAlerts: false,
            weeklyDigest: false,
            shadowITAlerts: true,
            costAnomalyAlerts: true,
            costAnomalyThreshold: 50,
          },
        },
      } as never);

      const { updateOrganizationNotificationSettings } =
        await import("./organization-notification-settings");
      const result = await updateOrganizationNotificationSettings({
        offboardingAlerts: false,
      });

      expect(result.success).toBe(true);
      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: "org-1" },
        data: {
          settings: {
            notifications: {
              emailEnabled: true,
              renewalAlertDays: [30],
              offboardingAlerts: false,
              weeklyDigest: false,
              shadowITAlerts: true,
              costAnomalyAlerts: true,
              costAnomalyThreshold: 50,
            },
          },
        },
      });
    });

    it("updates weekly digest settings", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
        expires: "",
      });

      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: "org-1",
        settings: {
          notifications: {
            emailEnabled: true,
            renewalAlertDays: [30],
            offboardingAlerts: true,
            weeklyDigest: false,
            shadowITAlerts: true,
            costAnomalyAlerts: true,
            costAnomalyThreshold: 50,
          },
        },
      } as never);

      vi.mocked(prisma.organization.update).mockResolvedValue({
        id: "org-1",
        settings: {
          notifications: {
            emailEnabled: true,
            renewalAlertDays: [30],
            offboardingAlerts: true,
            weeklyDigest: true,
            shadowITAlerts: true,
            costAnomalyAlerts: true,
            costAnomalyThreshold: 50,
          },
        },
      } as never);

      const { updateOrganizationNotificationSettings } =
        await import("./organization-notification-settings");
      const result = await updateOrganizationNotificationSettings({
        weeklyDigest: true,
      });

      expect(result.success).toBe(true);
      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: "org-1" },
        data: {
          settings: {
            notifications: {
              emailEnabled: true,
              renewalAlertDays: [30],
              offboardingAlerts: true,
              weeklyDigest: true,
              shadowITAlerts: true,
              costAnomalyAlerts: true,
              costAnomalyThreshold: 50,
            },
          },
        },
      });
    });

    it("calls revalidatePath after updating", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
        expires: "",
      });

      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: "org-1",
        settings: {},
      } as never);

      vi.mocked(prisma.organization.update).mockResolvedValue({
        id: "org-1",
        settings: {
          notifications: {
            emailEnabled: false,
            renewalAlertDays: [30],
            offboardingAlerts: true,
            weeklyDigest: false,
            shadowITAlerts: true,
            costAnomalyAlerts: true,
            costAnomalyThreshold: 50,
          },
        },
      } as never);

      const { updateOrganizationNotificationSettings } =
        await import("./organization-notification-settings");
      await updateOrganizationNotificationSettings({ emailEnabled: false });

      expect(revalidatePath).toHaveBeenCalledWith("/settings/notifications");
    });

    it("updates Shadow IT alert settings", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
        expires: "",
      });

      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: "org-1",
        settings: {
          notifications: {
            emailEnabled: true,
            renewalAlertDays: [30],
            offboardingAlerts: true,
            weeklyDigest: false,
            shadowITAlerts: true,
            costAnomalyAlerts: true,
            costAnomalyThreshold: 50,
          },
        },
      } as never);

      vi.mocked(prisma.organization.update).mockResolvedValue({
        id: "org-1",
        settings: {
          notifications: {
            emailEnabled: true,
            renewalAlertDays: [30],
            offboardingAlerts: true,
            weeklyDigest: false,
            shadowITAlerts: false,
            costAnomalyAlerts: true,
            costAnomalyThreshold: 50,
          },
        },
      } as never);

      const { updateOrganizationNotificationSettings } =
        await import("./organization-notification-settings");
      const result = await updateOrganizationNotificationSettings({
        shadowITAlerts: false,
      });

      expect(result.success).toBe(true);
      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: "org-1" },
        data: {
          settings: {
            notifications: {
              emailEnabled: true,
              renewalAlertDays: [30],
              offboardingAlerts: true,
              weeklyDigest: false,
              shadowITAlerts: false,
              costAnomalyAlerts: true,
              costAnomalyThreshold: 50,
            },
          },
        },
      });
    });

    it("updates the cost anomaly alert threshold", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
        expires: "",
      });

      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: "org-1",
        settings: {
          notifications: {
            emailEnabled: true,
            renewalAlertDays: [30],
            offboardingAlerts: true,
            weeklyDigest: false,
            shadowITAlerts: true,
            costAnomalyAlerts: true,
            costAnomalyThreshold: 50,
          },
        },
      } as never);

      vi.mocked(prisma.organization.update).mockResolvedValue({
        id: "org-1",
        settings: {
          notifications: {
            emailEnabled: true,
            renewalAlertDays: [30],
            offboardingAlerts: true,
            weeklyDigest: false,
            shadowITAlerts: true,
            costAnomalyAlerts: true,
            costAnomalyThreshold: 100,
          },
        },
      } as never);

      const { updateOrganizationNotificationSettings } =
        await import("./organization-notification-settings");
      const result = await updateOrganizationNotificationSettings({
        costAnomalyThreshold: 100,
      });

      expect(result.success).toBe(true);
      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: "org-1" },
        data: {
          settings: {
            notifications: {
              emailEnabled: true,
              renewalAlertDays: [30],
              offboardingAlerts: true,
              weeklyDigest: false,
              shadowITAlerts: true,
              costAnomalyAlerts: true,
              costAnomalyThreshold: 100,
            },
          },
        },
      });
    });

    it("returns an error for a non-admin user", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "MEMBER" },
        expires: "",
      });

      const { updateOrganizationNotificationSettings } =
        await import("./organization-notification-settings");
      const result = await updateOrganizationNotificationSettings({
        emailEnabled: true,
      });

      expect(result).toEqual({
        success: false,
        message: "Admin permission required",
      });
    });
  });
});
