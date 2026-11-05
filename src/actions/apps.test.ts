// src/actions/apps.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock modules
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    app: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    appTeam: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    paymentRecord: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock payment matching service
vi.mock("@/lib/services/payment/payment-matching", () => ({
  matchPaymentsToNewApp: vi.fn(),
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

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { matchPaymentsToNewApp } from "@/lib/services/payment/payment-matching";
import { createApp, deleteApp, getApp, getApps, updateApp } from "./apps";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockedAuth = auth as any;
const mockedMatchPayments = matchPaymentsToNewApp as ReturnType<typeof vi.fn>;

describe("Apps Server Actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRedirect.mockClear();
  });

  describe("getApps", () => {
    it("redirects to /login when unauthenticated", async () => {
      mockedAuth.mockResolvedValue(null);

      await expect(getApps()).rejects.toThrow("NEXT_REDIRECT");
      expect(mockRedirect).toHaveBeenCalledWith("/login");
    });

    it("redirects to /onboarding when there is no organization", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: null },
        expires: "",
      });

      await expect(getApps()).rejects.toThrow("NEXT_REDIRECT");
      expect(mockRedirect).toHaveBeenCalledWith("/onboarding");
    });

    it("returns the app list", async () => {
      mockedAuth.mockResolvedValue({
        user: {
          id: "user-1",
          organizationId: "org-1",
          role: "ADMIN",
          teamId: null,
        },
        expires: "",
      });

      const mockApps = [
        {
          id: "app-1",
          name: "Slack",
          status: "ACTIVE",
          source: "MANUAL",
          category: "Collaboration",
          customLogoUrl: null,
          catalog: { logoUrl: "https://example.com/slack.png" },
          owner: { name: "Ahmed Hassan", email: "hong@test.com" },
          teams: [],
          _count: { subscriptions: 2, userAccesses: 10 },
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-02"),
        },
        {
          id: "app-2",
          name: "Notion",
          status: "ACTIVE",
          source: "SSO_DISCOVERY",
          category: "Productivity",
          customLogoUrl: "https://custom.com/notion.png",
          catalog: null,
          owner: null,
          teams: [],
          _count: { subscriptions: 1, userAccesses: 5 },
          createdAt: new Date("2024-01-03"),
          updatedAt: new Date("2024-01-04"),
        },
      ];

      vi.mocked(prisma.app.findMany).mockResolvedValue(mockApps as never);
      vi.mocked(prisma.app.count).mockResolvedValue(2);

      const result = await getApps();

      expect(result.items).toHaveLength(2);
      expect(result.items[0].name).toBe("Slack");
      expect(result.items[0].catalogLogoUrl).toBe(
        "https://example.com/slack.png"
      );
      expect(result.items[0].ownerName).toBe("Ahmed Hassan");
      expect(result.items[1].customLogoUrl).toBe(
        "https://custom.com/notion.png"
      );
      expect(result.total).toBe(2);
    });

    it("lists apps with filters applied", async () => {
      mockedAuth.mockResolvedValue({
        user: {
          id: "user-1",
          organizationId: "org-1",
          role: "ADMIN",
          teamId: null,
        },
        expires: "",
      });

      vi.mocked(prisma.app.findMany).mockResolvedValue([]);
      vi.mocked(prisma.app.count).mockResolvedValue(0);

      await getApps({
        filter: { status: "ACTIVE", category: "Collaboration" },
        page: 2,
        limit: 10,
      });

      expect(prisma.app.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: "org-1",
            status: "ACTIVE",
            category: "Collaboration",
          }),
          skip: 10,
          take: 10,
        })
      );
    });

    it("searches apps by keyword", async () => {
      mockedAuth.mockResolvedValue({
        user: {
          id: "user-1",
          organizationId: "org-1",
          role: "ADMIN",
          teamId: null,
        },
        expires: "",
      });

      vi.mocked(prisma.app.findMany).mockResolvedValue([]);
      vi.mocked(prisma.app.count).mockResolvedValue(0);

      await getApps({ filter: { search: "Slack" } });

      expect(prisma.app.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: { contains: "Slack", mode: "insensitive" },
          }),
        })
      );
    });

    it("lets ADMIN see all apps", async () => {
      mockedAuth.mockResolvedValue({
        user: {
          id: "user-1",
          organizationId: "org-1",
          role: "ADMIN",
          teamId: null,
        },
        expires: "",
      });

      const mockApps = [
        {
          id: "app-1",
          name: "Slack",
          status: "ACTIVE",
          source: "MANUAL",
          category: "Collaboration",
          customLogoUrl: null,
          catalog: null,
          owner: null,
          teams: [],
          _count: { subscriptions: 1, userAccesses: 5 },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(prisma.app.findMany).mockResolvedValue(mockApps as never);
      vi.mocked(prisma.app.count).mockResolvedValue(1);

      const result = await getApps();

      expect(result.items).toHaveLength(1);
      // ADMIN is called without a teams filter
      expect(prisma.app.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: "org-1",
          }),
        })
      );
    });

    it("limits MEMBER to their own teams' apps", async () => {
      mockedAuth.mockResolvedValue({
        user: {
          id: "user-1",
          organizationId: "org-1",
          role: "MEMBER",
          teamId: "team-1",
        },
        expires: "",
      });

      vi.mocked(prisma.app.findMany).mockResolvedValue([]);
      vi.mocked(prisma.app.count).mockResolvedValue(0);

      await getApps();

      expect(prisma.app.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: "org-1",
            teams: { some: { teamId: "team-1" } },
          }),
        })
      );
    });

    it("returns an empty list for a MEMBER without a team", async () => {
      mockedAuth.mockResolvedValue({
        user: {
          id: "user-1",
          organizationId: "org-1",
          role: "MEMBER",
          teamId: null,
        },
        expires: "",
      });

      const result = await getApps();

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      // The DB query itself must not be called
      expect(prisma.app.findMany).not.toHaveBeenCalled();
    });

    it("applies the same restriction to VIEWER as to MEMBER", async () => {
      mockedAuth.mockResolvedValue({
        user: {
          id: "user-1",
          organizationId: "org-1",
          role: "VIEWER",
          teamId: "team-2",
        },
        expires: "",
      });

      vi.mocked(prisma.app.findMany).mockResolvedValue([]);
      vi.mocked(prisma.app.count).mockResolvedValue(0);

      await getApps();

      expect(prisma.app.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            teams: { some: { teamId: "team-2" } },
          }),
        })
      );
    });
  });

  describe("getApp", () => {
    it("redirects to /login when unauthenticated", async () => {
      mockedAuth.mockResolvedValue(null);

      await expect(getApp("app-1")).rejects.toThrow("NEXT_REDIRECT");
      expect(mockRedirect).toHaveBeenCalledWith("/login");
    });

    it("returns app details", async () => {
      mockedAuth.mockResolvedValue({
        user: {
          id: "user-1",
          organizationId: "org-1",
          role: "ADMIN",
          teamId: null,
        },
        expires: "",
      });

      const mockApp = {
        id: "app-1",
        name: "Slack",
        status: "ACTIVE",
        source: "MANUAL",
        category: "Collaboration",
        catalogId: "catalog-1",
        customLogoUrl: null,
        customWebsite: "https://slack.com",
        notes: "Team communication tool",
        tags: ["communication", "team"],
        riskScore: 10,
        discoveredAt: null,
        catalog: { logoUrl: "https://example.com/slack.png" },
        owner: { name: "Ahmed Hassan", email: "hong@test.com" },
        teams: [],
        _count: { subscriptions: 2, userAccesses: 10 },
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-02"),
      };

      vi.mocked(prisma.app.findFirst).mockResolvedValue(mockApp as never);

      const result = await getApp("app-1");

      expect(result).not.toBeNull();
      expect(result?.name).toBe("Slack");
      expect(result?.notes).toBe("Team communication tool");
      expect(result?.tags).toEqual(["communication", "team"]);
    });

    it("returns null when the app does not exist", async () => {
      mockedAuth.mockResolvedValue({
        user: {
          id: "user-1",
          organizationId: "org-1",
          role: "ADMIN",
          teamId: null,
        },
        expires: "",
      });

      vi.mocked(prisma.app.findFirst).mockResolvedValue(null);

      const result = await getApp("non-existent");

      expect(result).toBeNull();
    });

    it("cannot view another organization's app", async () => {
      mockedAuth.mockResolvedValue({
        user: {
          id: "user-1",
          organizationId: "org-1",
          role: "ADMIN",
          teamId: null,
        },
        expires: "",
      });

      vi.mocked(prisma.app.findFirst).mockResolvedValue(null);

      const result = await getApp("app-other-org");

      expect(prisma.app.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "app-other-org", organizationId: "org-1" },
        })
      );
      expect(result).toBeNull();
    });

    it("lets ADMIN view any app's details", async () => {
      mockedAuth.mockResolvedValue({
        user: {
          id: "user-1",
          organizationId: "org-1",
          role: "ADMIN",
          teamId: null,
        },
        expires: "",
      });

      const mockApp = {
        id: "app-1",
        name: "Slack",
        status: "ACTIVE",
        source: "MANUAL",
        category: "Collaboration",
        catalogId: null,
        customLogoUrl: null,
        customWebsite: null,
        notes: null,
        tags: [],
        riskScore: null,
        discoveredAt: null,
        catalog: null,
        owner: null,
        teams: [
          {
            teamId: "team-other",
            team: { id: "team-other", name: "Other Team" },
          },
        ],
        _count: { subscriptions: 1, userAccesses: 5 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.app.findFirst).mockResolvedValue(mockApp as never);

      const result = await getApp("app-1");

      expect(result).not.toBeNull();
      expect(result?.name).toBe("Slack");
    });

    it("lets MEMBER view only apps assigned to their teams", async () => {
      mockedAuth.mockResolvedValue({
        user: {
          id: "user-1",
          organizationId: "org-1",
          role: "MEMBER",
          teamId: "team-1",
        },
        expires: "",
      });

      const mockApp = {
        id: "app-1",
        name: "Slack",
        status: "ACTIVE",
        source: "MANUAL",
        category: "Collaboration",
        catalogId: null,
        customLogoUrl: null,
        customWebsite: null,
        notes: null,
        tags: [],
        riskScore: null,
        discoveredAt: null,
        catalog: null,
        owner: null,
        teams: [{ teamId: "team-1", team: { id: "team-1", name: "My Team" } }],
        _count: { subscriptions: 1, userAccesses: 5 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.app.findFirst).mockResolvedValue(mockApp as never);

      const result = await getApp("app-1");

      expect(result).not.toBeNull();
      expect(result?.name).toBe("Slack");
    });

    it("prevents MEMBER from viewing another team's app", async () => {
      mockedAuth.mockResolvedValue({
        user: {
          id: "user-1",
          organizationId: "org-1",
          role: "MEMBER",
          teamId: "team-1",
        },
        expires: "",
      });

      const mockApp = {
        id: "app-1",
        name: "Slack",
        status: "ACTIVE",
        source: "MANUAL",
        category: "Collaboration",
        catalogId: null,
        customLogoUrl: null,
        customWebsite: null,
        notes: null,
        tags: [],
        riskScore: null,
        discoveredAt: null,
        catalog: null,
        owner: null,
        teams: [
          {
            teamId: "team-other",
            team: { id: "team-other", name: "Other Team" },
          },
        ],
        _count: { subscriptions: 1, userAccesses: 5 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.app.findFirst).mockResolvedValue(mockApp as never);

      const result = await getApp("app-1");

      // Another team's app, so null is returned
      expect(result).toBeNull();
    });

    it("prevents a MEMBER without a team from viewing app details", async () => {
      mockedAuth.mockResolvedValue({
        user: {
          id: "user-1",
          organizationId: "org-1",
          role: "MEMBER",
          teamId: null,
        },
        expires: "",
      });

      const mockApp = {
        id: "app-1",
        name: "Slack",
        status: "ACTIVE",
        source: "MANUAL",
        category: "Collaboration",
        catalogId: null,
        customLogoUrl: null,
        customWebsite: null,
        notes: null,
        tags: [],
        riskScore: null,
        discoveredAt: null,
        catalog: null,
        owner: null,
        teams: [
          { teamId: "team-1", team: { id: "team-1", name: "Some Team" } },
        ],
        _count: { subscriptions: 1, userAccesses: 5 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.app.findFirst).mockResolvedValue(mockApp as never);

      const result = await getApp("app-1");

      // No team membership, so null is returned
      expect(result).toBeNull();
    });
  });

  describe("createApp", () => {
    it("redirects to /login when unauthenticated", async () => {
      mockedAuth.mockResolvedValue(null);

      const formData = new FormData();
      formData.append("name", "New App");

      await expect(createApp({ success: false }, formData)).rejects.toThrow(
        "NEXT_REDIRECT:/login"
      );
    });

    it("returns an error when the app name is empty", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1" },
        expires: "",
      });

      const formData = new FormData();
      formData.append("name", "");

      const result = await createApp({ success: false }, formData);

      expect(result.success).toBe(false);
      expect(result.errors?.name).toBeDefined();
    });

    it("returns an error when the app name is too short", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1" },
        expires: "",
      });

      const formData = new FormData();
      formData.append("name", "A");

      const result = await createApp({ success: false }, formData);

      expect(result.success).toBe(false);
      expect(result.errors?.name).toBeDefined();
    });

    it("returns an error for a duplicate app name", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1" },
        expires: "",
      });

      vi.mocked(prisma.app.findFirst).mockResolvedValueOnce({
        id: "existing-app",
        name: "Slack",
        organizationId: "org-1",
      } as never);

      const formData = new FormData();
      formData.append("name", "Slack");

      const result = await createApp({ success: false }, formData);

      expect(result.success).toBe(false);
      expect(result.message).toBe("An app with this name already exists");
    });

    it("creates the app successfully", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1" },
        expires: "",
      });

      vi.mocked(prisma.app.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.app.create).mockResolvedValueOnce({
        id: "new-app",
        name: "New App",
        status: "ACTIVE",
        source: "MANUAL",
        category: "Productivity",
        organizationId: "org-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

      const formData = new FormData();
      formData.append("name", "New App");
      formData.append("category", "Productivity");
      formData.append("customWebsite", "https://newapp.com");
      formData.append("notes", "A new app");

      const result = await createApp({ success: false }, formData);

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe("new-app");
      expect(prisma.app.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "New App",
            category: "Productivity",
            customWebsite: "https://newapp.com",
            notes: "A new app",
            organizationId: "org-1",
          }),
        })
      );
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it("creates an app with tags", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1" },
        expires: "",
      });

      vi.mocked(prisma.app.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.app.create).mockResolvedValueOnce({
        id: "new-app",
        name: "Tagged App",
        tags: ["tag1", "tag2"],
      } as never);

      const formData = new FormData();
      formData.append("name", "Tagged App");
      formData.append("tags", "tag1,tag2");

      const result = await createApp({ success: false }, formData);

      expect(result.success).toBe(true);
      expect(prisma.app.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tags: ["tag1", "tag2"],
          }),
        })
      );
    });

    describe("payment matching integration", () => {
      it("calls matchPaymentsToNewApp after creating the app", async () => {
        mockedAuth.mockResolvedValue({
          user: { id: "user-1", organizationId: "org-1" },
          expires: "",
        });

        vi.mocked(prisma.app.findFirst).mockResolvedValueOnce(null);
        vi.mocked(prisma.app.create).mockResolvedValueOnce({
          id: "new-app",
          name: "Datadog",
          status: "ACTIVE",
          source: "MANUAL",
          organizationId: "org-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        } as never);
        mockedMatchPayments.mockResolvedValueOnce({
          matchedCount: 3,
          totalScanned: 10,
        });

        const formData = new FormData();
        formData.append("name", "Datadog");

        const result = await createApp({ success: false }, formData);

        expect(result.success).toBe(true);
        expect(mockedMatchPayments).toHaveBeenCalledWith(
          "new-app",
          "Datadog",
          "org-1"
        );
      });

      it("includes matchedPaymentCount in the create response", async () => {
        mockedAuth.mockResolvedValue({
          user: { id: "user-1", organizationId: "org-1" },
          expires: "",
        });

        vi.mocked(prisma.app.findFirst).mockResolvedValueOnce(null);
        vi.mocked(prisma.app.create).mockResolvedValueOnce({
          id: "new-app",
          name: "Slack",
          status: "ACTIVE",
          source: "MANUAL",
          organizationId: "org-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        } as never);
        mockedMatchPayments.mockResolvedValueOnce({
          matchedCount: 5,
          totalScanned: 20,
        });

        const formData = new FormData();
        formData.append("name", "Slack");

        const result = await createApp({ success: false }, formData);

        expect(result.success).toBe(true);
        expect(result.data?.id).toBe("new-app");
        expect(result.data?.matchedPaymentCount).toBe(5);
      });

      it("still creates the app when matching fails (graceful degradation)", async () => {
        mockedAuth.mockResolvedValue({
          user: { id: "user-1", organizationId: "org-1" },
          expires: "",
        });

        vi.mocked(prisma.app.findFirst).mockResolvedValueOnce(null);
        vi.mocked(prisma.app.create).mockResolvedValueOnce({
          id: "new-app",
          name: "Notion",
          status: "ACTIVE",
          source: "MANUAL",
          organizationId: "org-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        } as never);
        // matchPaymentsToNewApp throws an error
        mockedMatchPayments.mockRejectedValueOnce(
          new Error("DB connection failed")
        );

        const formData = new FormData();
        formData.append("name", "Notion");

        const result = await createApp({ success: false }, formData);

        // App creation should succeed despite matching error
        expect(result.success).toBe(true);
        expect(result.data?.id).toBe("new-app");
        // matchedPaymentCount should be 0 when matching fails
        expect(result.data?.matchedPaymentCount).toBe(0);
      });
    });
  });

  describe("updateApp", () => {
    it("redirects to /login when unauthenticated", async () => {
      mockedAuth.mockResolvedValue(null);

      const formData = new FormData();
      formData.append("name", "Updated App");

      await expect(
        updateApp("app-1", { success: false }, formData)
      ).rejects.toThrow("NEXT_REDIRECT:/login");
    });

    it("returns an error when the app does not exist", async () => {
      mockedAuth.mockResolvedValue({
        user: {
          id: "user-1",
          organizationId: "org-1",
          role: "ADMIN",
          teamId: null,
        },
        expires: "",
      });

      vi.mocked(prisma.app.findFirst).mockResolvedValueOnce(null);

      const formData = new FormData();
      formData.append("name", "Updated App");

      const result = await updateApp(
        "non-existent",
        { success: false },
        formData
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe("App not found");
    });

    it("updates the app successfully", async () => {
      mockedAuth.mockResolvedValue({
        user: {
          id: "user-1",
          organizationId: "org-1",
          role: "ADMIN",
          teamId: null,
        },
        expires: "",
      });

      vi.mocked(prisma.app.findFirst)
        .mockResolvedValueOnce({
          id: "app-1",
          name: "Old Name",
          status: "ACTIVE",
          organizationId: "org-1",
        } as never)
        .mockResolvedValueOnce(null);

      vi.mocked(prisma.app.update).mockResolvedValueOnce({
        id: "app-1",
        name: "Updated Name",
        category: "Updated Category",
        status: "ACTIVE",
      } as never);

      const formData = new FormData();
      formData.append("name", "Updated Name");
      formData.append("category", "Updated Category");

      const result = await updateApp("app-1", { success: false }, formData);

      expect(result.success).toBe(true);
      expect(prisma.app.update).toHaveBeenCalledWith({
        where: { id: "app-1" },
        data: expect.objectContaining({
          name: "Updated Name",
          category: "Updated Category",
        }),
      });
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it("returns an error when the name duplicates another app", async () => {
      mockedAuth.mockResolvedValue({
        user: {
          id: "user-1",
          organizationId: "org-1",
          role: "ADMIN",
          teamId: null,
        },
        expires: "",
      });

      vi.mocked(prisma.app.findFirst)
        .mockResolvedValueOnce({
          id: "app-1",
          name: "Old Name",
          status: "ACTIVE",
          organizationId: "org-1",
        } as never)
        .mockResolvedValueOnce({
          id: "app-2",
          name: "Existing Name",
          organizationId: "org-1",
        } as never);

      const formData = new FormData();
      formData.append("name", "Existing Name");

      const result = await updateApp("app-1", { success: false }, formData);

      expect(result.success).toBe(false);
      expect(result.message).toBe("An app with this name already exists");
    });

    it("can change the app status", async () => {
      mockedAuth.mockResolvedValue({
        user: {
          id: "user-1",
          organizationId: "org-1",
          role: "ADMIN",
          teamId: null,
        },
        expires: "",
      });

      vi.mocked(prisma.app.findFirst)
        .mockResolvedValueOnce({
          id: "app-1",
          name: "App",
          status: "ACTIVE",
          organizationId: "org-1",
        } as never)
        .mockResolvedValueOnce(null);

      vi.mocked(prisma.app.update).mockResolvedValueOnce({
        id: "app-1",
        name: "App",
        status: "INACTIVE",
      } as never);

      const formData = new FormData();
      formData.append("name", "App");
      formData.append("status", "INACTIVE");

      const result = await updateApp("app-1", { success: false }, formData);

      expect(result.success).toBe(true);
      expect(prisma.app.update).toHaveBeenCalledWith({
        where: { id: "app-1" },
        data: expect.objectContaining({
          status: "INACTIVE",
        }),
      });
    });
  });

  describe("deleteApp", () => {
    it("redirects to /login when unauthenticated", async () => {
      mockedAuth.mockResolvedValue(null);

      await expect(deleteApp("app-1")).rejects.toThrow("NEXT_REDIRECT:/login");
    });

    it("returns an error when the app does not exist", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
        expires: "",
      });

      vi.mocked(prisma.app.findFirst).mockResolvedValueOnce(null);

      const result = await deleteApp("non-existent");

      expect(result.success).toBe(false);
      expect(result.message).toBe("App not found");
    });

    it("deletes the app successfully", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
        expires: "",
      });

      vi.mocked(prisma.app.findFirst).mockResolvedValueOnce({
        id: "app-1",
        name: "App to Delete",
        organizationId: "org-1",
      } as never);

      vi.mocked(prisma.app.delete).mockResolvedValueOnce({
        id: "app-1",
        name: "App to Delete",
      } as never);

      const result = await deleteApp("app-1");

      expect(result.success).toBe(true);
      expect(prisma.app.delete).toHaveBeenCalledWith({
        where: { id: "app-1" },
      });
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });
  });
});
