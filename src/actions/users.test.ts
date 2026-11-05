// src/actions/users.test.ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getTerminatedUsersWithAccess,
  getUser,
  getUsers,
  revokeAllUserAppAccess,
  revokeUserAppAccess,
  updateUser,
} from "./users";
import { permanentlyDeleteUser } from "./users-write";

// Mock dependencies
// Organisation base currency (settings registry) is resolved via the FX helper
vi.mock("@/lib/fx/base-currency", () => ({
  getBaseCurrency: vi.fn().mockResolvedValue("KRW"),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    },
    userAppAccess: {
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    subscriptionUser: {
      deleteMany: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    subscription: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    app: {
      updateMany: vi.fn(),
    },
    corporateCard: {
      updateMany: vi.fn(),
    },
    cardTransaction: {
      updateMany: vi.fn(),
    },
    invitation: {
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Mock next/navigation redirect
const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mockRedirect(url);
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockedAuth = auth as any;

describe("Users Server Actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRedirect.mockClear();
  });

  describe("getUsers", () => {
    it("redirects to login when unauthenticated", async () => {
      mockedAuth.mockResolvedValue(null);

      await expect(getUsers()).rejects.toThrow("NEXT_REDIRECT");

      expect(mockRedirect).toHaveBeenCalledWith("/login");
    });

    it("redirects to onboarding when there is no organizationId", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: null },
        expires: "",
      });

      await expect(getUsers()).rejects.toThrow("NEXT_REDIRECT");

      expect(mockRedirect).toHaveBeenCalledWith("/onboarding");
    });

    it("returns the user list", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1" },
        expires: "",
      });

      const mockUsers = [
        {
          id: "user-1",
          email: "test@example.com",
          name: "Test User",
          avatarUrl: null,
          role: "MEMBER",
          status: "ACTIVE",
          department: "Engineering",
          jobTitle: "Developer",
          lastLoginAt: new Date("2024-01-15"),
          terminatedAt: null,
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-15"),
          subscriptionAssignments: [
            { subscription: { appId: "app-1" } },
            { subscription: { appId: "app-2" } },
            { subscription: { appId: "app-1" } }, // duplicate
            { subscription: { appId: "app-3" } },
            { subscription: { appId: "app-4" } },
          ],
        },
      ];

      vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as never);
      vi.mocked(prisma.user.count).mockResolvedValue(1);

      const result = await getUsers();

      expect(result.items).toHaveLength(1);
      expect(result.items[0].email).toBe("test@example.com");
      expect(result.items[0].assignedAppCount).toBe(4);
      expect(result.total).toBe(1);
    });

    it("queries users with filter conditions", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1" },
        expires: "",
      });

      vi.mocked(prisma.user.findMany).mockResolvedValue([]);
      vi.mocked(prisma.user.count).mockResolvedValue(0);

      await getUsers({ filter: { status: "ACTIVE", role: "ADMIN" } });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: "org-1",
            status: "ACTIVE",
            role: "ADMIN",
          }),
        })
      );
    });

    it("queries users by search keyword", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1" },
        expires: "",
      });

      vi.mocked(prisma.user.findMany).mockResolvedValue([]);
      vi.mocked(prisma.user.count).mockResolvedValue(0);

      await getUsers({ filter: { search: "test" } });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { email: { contains: "test", mode: "insensitive" } },
              { name: { contains: "test", mode: "insensitive" } },
            ]),
          }),
        })
      );
    });
  });

  describe("getUser", () => {
    it("returns user details", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1" },
        expires: "",
      });

      const mockUser = {
        id: "user-1",
        email: "test@example.com",
        name: "Test User",
        avatarUrl: null,
        role: "MEMBER",
        status: "ACTIVE",
        department: "Engineering",
        jobTitle: "Developer",
        employeeId: "EMP001",
        lastLoginAt: new Date("2024-01-15"),
        terminatedAt: null,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-15"),
        subscriptionAssignments: [
          { subscription: { appId: "app-1" } },
          { subscription: { appId: "app-2" } },
        ],
        appAccesses: [
          {
            id: "access-1",
            appId: "app-1",
            accessLevel: "admin",
            grantedAt: new Date("2024-01-01"),
            lastUsedAt: new Date("2024-01-15"),
            source: "SSO_LOG",
            app: {
              id: "app-1",
              name: "Slack",
              customLogoUrl: "https://example.com/slack.png",
              catalog: null,
            },
          },
        ],
      };

      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as never);
      // Mock subscription.findMany for getUser
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);

      const result = await getUser("user-1");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("user-1");
      expect(result?.email).toBe("test@example.com");
      expect(result?.appAccesses).toHaveLength(1);
      expect(result?.appAccesses[0].appName).toBe("Slack");
    });

    it("returns null for a non-existent user", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1" },
        expires: "",
      });

      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      // Mock subscription.findMany for getUser (still called in parallel)
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);

      const result = await getUser("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("updateUser", () => {
    it("redirects to /login when unauthenticated", async () => {
      mockedAuth.mockResolvedValue(null);

      const formData = new FormData();
      formData.append("name", "Updated Name");

      await expect(
        updateUser("user-1", { success: false }, formData)
      ).rejects.toThrow("NEXT_REDIRECT:/login");
    });

    it("returns an error when the user does not exist", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1" },
        expires: "",
      });

      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

      const formData = new FormData();
      formData.append("name", "Updated Name");

      const result = await updateUser(
        "non-existent",
        { success: false },
        formData
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe("User not found");
    });

    it("updates user details successfully", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "current-user", organizationId: "org-1" },
        expires: "",
      });

      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: "user-1",
        email: "test@example.com",
        organizationId: "org-1",
      } as never);

      vi.mocked(prisma.user.update).mockResolvedValue({
        id: "user-1",
        name: "Updated Name",
      } as never);

      const formData = new FormData();
      formData.append("name", "Updated Name");
      formData.append("department", "Marketing");

      const result = await updateUser("user-1", { success: false }, formData);

      expect(result.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalled();
      expect(revalidatePath).toHaveBeenCalledWith("/users");
    });
  });

  describe("getTerminatedUsersWithAccess", () => {
    it("returns terminated users who still have unrecovered access", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1" },
        expires: "",
      });

      const mockTerminatedUsers = [
        {
          id: "terminated-1",
          email: "terminated@example.com",
          name: "Terminated User",
          avatarUrl: null,
          department: "Engineering",
          jobTitle: "Developer",
          terminatedAt: new Date("2024-01-01"),
          _count: { appAccesses: 2, subscriptionAssignments: 1 },
          appAccesses: [
            {
              id: "access-1",
              appId: "app-1",
              accessLevel: "user",
              grantedAt: new Date("2023-06-01"),
              lastUsedAt: new Date("2023-12-15"),
              source: "SSO_LOG",
              app: {
                id: "app-1",
                name: "Slack",
                customLogoUrl: null,
                catalog: { logoUrl: "https://example.com/slack.png" },
              },
            },
          ],
          subscriptionAssignments: [
            {
              id: "sa-1",
              subscriptionId: "sub-1",
              assignedAt: new Date("2023-07-01"),
              subscription: {
                appId: "app-2",
                billingCycle: "MONTHLY",
                billingType: "PER_USER",
                app: {
                  name: "Notion",
                  customLogoUrl: null,
                  catalog: null,
                },
              },
            },
          ],
        },
      ];

      vi.mocked(prisma.user.findMany).mockResolvedValue(
        mockTerminatedUsers as never
      );

      const result = await getTerminatedUsersWithAccess();

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe("terminated@example.com");
      expect(result[0].unrevokedAccessCount).toBe(3);
      expect(result[0].appAccesses).toHaveLength(1);
      expect(result[0].subscriptionAssignments).toHaveLength(1);
    });
  });

  describe("revokeUserAppAccess", () => {
    it("redirects to /login when unauthenticated", async () => {
      mockedAuth.mockResolvedValue(null);

      await expect(revokeUserAppAccess("user-1", "app-1")).rejects.toThrow(
        "NEXT_REDIRECT:/login"
      );
    });

    it("revokes a user's app access successfully", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "current-user", organizationId: "org-1" },
        expires: "",
      });

      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: "user-1",
        email: "test@example.com",
        organizationId: "org-1",
        appAccesses: [
          {
            id: "access-1",
            appId: "app-1",
            app: { id: "app-1", name: "Slack" },
          },
        ],
      } as never);

      vi.mocked(prisma.subscriptionUser.findMany).mockResolvedValue([]);
      vi.mocked(prisma.$transaction).mockImplementation(async (cb) => {
        if (typeof cb === "function") {
          return cb(prisma);
        }
        return cb;
      });
      vi.mocked(prisma.userAppAccess.delete).mockResolvedValue({
        id: "access-1",
      } as never);

      const result = await revokeUserAppAccess("user-1", "app-1");

      expect(result.success).toBe(true);
      expect(prisma.userAppAccess.delete).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalled();
      expect(revalidatePath).toHaveBeenCalledWith("/users");
      expect(revalidatePath).toHaveBeenCalledWith("/subscriptions");
    });

    it("deletes the app's SubscriptionUser rows and recalculates usedLicenses on single revoke", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "current-user", organizationId: "org-1" },
        expires: "",
      });

      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: "user-1",
        email: "test@example.com",
        organizationId: "org-1",
        appAccesses: [
          {
            id: "access-1",
            appId: "app-1",
            app: { id: "app-1", name: "Slack" },
          },
        ],
      } as never);

      // SubscriptionUser rows exist for that app's subscriptions
      vi.mocked(prisma.subscriptionUser.findMany).mockResolvedValue([
        { id: "su-1", subscriptionId: "sub-1" },
      ] as never);

      vi.mocked(prisma.$transaction).mockImplementation(async (cb) => {
        if (typeof cb === "function") {
          return cb(prisma);
        }
        return cb;
      });
      vi.mocked(prisma.userAppAccess.delete).mockResolvedValue({
        id: "access-1",
      } as never);
      vi.mocked(prisma.subscriptionUser.deleteMany).mockResolvedValue({
        count: 1,
      });
      vi.mocked(prisma.subscriptionUser.count).mockResolvedValue(4);
      vi.mocked(prisma.subscription.update).mockResolvedValue({} as never);

      const result = await revokeUserAppAccess("user-1", "app-1");

      expect(result.success).toBe(true);
      // Verify SubscriptionUser deletion
      expect(prisma.subscriptionUser.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          subscription: { appId: "app-1" },
        },
      });
      // Verify usedLicenses recalculation
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: "sub-1" },
        data: { usedLicenses: 4 },
      });
      // Verify subscription page revalidation
      expect(revalidatePath).toHaveBeenCalledWith("/subscriptions");
      expect(revalidatePath).toHaveBeenCalledWith("/subscriptions/sub-1");
    });

    it("returns an error when there is no access grant", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "current-user", organizationId: "org-1" },
        expires: "",
      });

      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: "user-1",
        email: "test@example.com",
        organizationId: "org-1",
        appAccesses: [],
      } as never);

      const result = await revokeUserAppAccess("user-1", "app-1");

      expect(result.success).toBe(false);
      expect(result.message).toBe("Access grant not found");
    });
  });

  describe("revokeAllUserAppAccess", () => {
    it("redirects to /login when unauthenticated", async () => {
      mockedAuth.mockResolvedValue(null);

      await expect(revokeAllUserAppAccess("user-1")).rejects.toThrow(
        "NEXT_REDIRECT:/login"
      );
    });

    it("revokes all of a user's app access successfully", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "current-user", organizationId: "org-1" },
        expires: "",
      });

      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: "user-1",
        email: "test@example.com",
        organizationId: "org-1",
        appAccesses: [
          { id: "access-1", appId: "app-1" },
          { id: "access-2", appId: "app-2" },
        ],
        subscriptionAssignments: [{ id: "sa-1", subscriptionId: "sub-1" }],
      } as never);

      // Interactive transaction mock: execute the callback with prisma as tx
      vi.mocked(prisma.$transaction).mockImplementation(async (cb) => {
        if (typeof cb === "function") {
          return cb(prisma);
        }
        return cb;
      });
      vi.mocked(prisma.userAppAccess.deleteMany).mockResolvedValue({
        count: 2,
      });
      vi.mocked(prisma.subscriptionUser.deleteMany).mockResolvedValue({
        count: 1,
      });
      vi.mocked(prisma.subscriptionUser.count).mockResolvedValue(3);
      vi.mocked(prisma.subscription.update).mockResolvedValue({} as never);

      const result = await revokeAllUserAppAccess("user-1");

      expect(result.success).toBe(true);
      expect(result.message).toBe("Revoked 3 access grant(s)");
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              revokedAppAccessCount: 2,
              revokedSubscriptionAssignmentCount: 1,
              revokedCount: 3,
            }),
          }),
        })
      );
      expect(revalidatePath).toHaveBeenCalledWith("/users");
      expect(revalidatePath).toHaveBeenCalledWith("/users/offboarded");
      expect(revalidatePath).toHaveBeenCalledWith("/subscriptions");
      expect(revalidatePath).toHaveBeenCalledWith("/subscriptions/sub-1");
    });

    it("succeeds even when only subscriptionAssignments exist (bug reproduction)", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "current-user", organizationId: "org-1" },
        expires: "",
      });

      // Bug scenario: appAccesses=0, subscriptionAssignments>=1
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: "user-1",
        email: "test@example.com",
        organizationId: "org-1",
        appAccesses: [],
        subscriptionAssignments: [
          { id: "sa-1", subscriptionId: "sub-1" },
          { id: "sa-2", subscriptionId: "sub-2" },
        ],
      } as never);

      vi.mocked(prisma.$transaction).mockImplementation(async (cb) => {
        if (typeof cb === "function") {
          return cb(prisma);
        }
        return cb;
      });
      vi.mocked(prisma.userAppAccess.deleteMany).mockResolvedValue({
        count: 0,
      });
      vi.mocked(prisma.subscriptionUser.deleteMany).mockResolvedValue({
        count: 2,
      });
      vi.mocked(prisma.subscriptionUser.count).mockResolvedValue(1);
      vi.mocked(prisma.subscription.update).mockResolvedValue({} as never);

      const result = await revokeAllUserAppAccess("user-1");

      expect(result.success).toBe(true);
      expect(result.message).toBe("Revoked 2 access grant(s)");
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it("recalculates usedLicenses of affected subscriptions on revoke", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "current-user", organizationId: "org-1" },
        expires: "",
      });

      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: "user-1",
        email: "test@example.com",
        organizationId: "org-1",
        appAccesses: [{ id: "access-1", appId: "app-1" }],
        subscriptionAssignments: [
          { id: "sa-1", subscriptionId: "sub-1" },
          { id: "sa-2", subscriptionId: "sub-2" },
        ],
      } as never);

      vi.mocked(prisma.$transaction).mockImplementation(async (cb) => {
        if (typeof cb === "function") {
          return cb(prisma);
        }
        return cb;
      });
      vi.mocked(prisma.userAppAccess.deleteMany).mockResolvedValue({
        count: 1,
      });
      vi.mocked(prisma.subscriptionUser.deleteMany).mockResolvedValue({
        count: 2,
      });
      // sub-1: 2 users left, sub-2: 0 users left
      vi.mocked(prisma.subscriptionUser.count)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(0);
      vi.mocked(prisma.subscription.update).mockResolvedValue({} as never);

      const result = await revokeAllUserAppAccess("user-1");

      expect(result.success).toBe(true);
      // sub-1 usedLicenses = 2
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: "sub-1" },
        data: { usedLicenses: 2 },
      });
      // sub-2 usedLicenses = 0
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: "sub-2" },
        data: { usedLicenses: 0 },
      });
    });

    it("returns an error when the user cannot be found", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "current-user", organizationId: "org-1" },
        expires: "",
      });

      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

      const result = await revokeAllUserAppAccess("non-existent");

      expect(result.success).toBe(false);
      expect(result.message).toBe("User not found");
    });

    it("returns an error when there are neither appAccesses nor subscriptionAssignments", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "current-user", organizationId: "org-1" },
        expires: "",
      });

      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: "user-1",
        email: "test@example.com",
        organizationId: "org-1",
        appAccesses: [],
        subscriptionAssignments: [],
      } as never);

      const result = await revokeAllUserAppAccess("user-1");

      expect(result.success).toBe(false);
      expect(result.message).toBe("There is no access to revoke");
    });
  });

  describe("permanentlyDeleteUser", () => {
    it("recalculates usedLicenses of affected subscriptions on cascade delete", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "admin-user", organizationId: "org-1", role: "ADMIN" },
        expires: "",
      });

      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: "target-user",
        email: "terminated@example.com",
        name: "Terminated User",
        role: "MEMBER",
        status: "TERMINATED",
        department: "Engineering",
        organizationId: "org-1",
      } as never);

      // Fetch affected subscriptions before deletion
      vi.mocked(prisma.subscriptionUser.findMany).mockResolvedValue([
        { subscriptionId: "sub-1" },
        { subscriptionId: "sub-2" },
      ] as never);

      vi.mocked(prisma.$transaction).mockImplementation(async (cb) => {
        if (typeof cb === "function") {
          return cb(prisma);
        }
        return cb;
      });
      vi.mocked(prisma.app.updateMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.corporateCard.updateMany).mockResolvedValue({
        count: 0,
      });
      vi.mocked(prisma.cardTransaction.updateMany).mockResolvedValue({
        count: 0,
      });
      vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.invitation.deleteMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.user.delete).mockResolvedValue({} as never);
      vi.mocked(prisma.subscriptionUser.count)
        .mockResolvedValueOnce(5) // sub-1: 5 users left
        .mockResolvedValueOnce(0); // sub-2: 0 users left
      vi.mocked(prisma.subscription.update).mockResolvedValue({} as never);

      const result = await permanentlyDeleteUser("target-user");

      expect(result.success).toBe(true);
      // Verify usedLicenses recalculation of affected subscriptions
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: "sub-1" },
        data: { usedLicenses: 5 },
      });
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: "sub-2" },
        data: { usedLicenses: 0 },
      });
      // Verify subscription page revalidation
      expect(revalidatePath).toHaveBeenCalledWith("/subscriptions");
      expect(revalidatePath).toHaveBeenCalledWith("/subscriptions/sub-1");
      expect(revalidatePath).toHaveBeenCalledWith("/subscriptions/sub-2");
    });

    it("succeeds without recalculating usedLicenses when deleting a user with no assignments", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "admin-user", organizationId: "org-1", role: "ADMIN" },
        expires: "",
      });

      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: "target-user",
        email: "terminated@example.com",
        name: "Terminated User",
        role: "MEMBER",
        status: "TERMINATED",
        department: "Engineering",
        organizationId: "org-1",
      } as never);

      // No subscription assignments
      vi.mocked(prisma.subscriptionUser.findMany).mockResolvedValue([]);

      vi.mocked(prisma.$transaction).mockImplementation(async (cb) => {
        if (typeof cb === "function") {
          return cb(prisma);
        }
        return cb;
      });
      vi.mocked(prisma.app.updateMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.corporateCard.updateMany).mockResolvedValue({
        count: 0,
      });
      vi.mocked(prisma.cardTransaction.updateMany).mockResolvedValue({
        count: 0,
      });
      vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.invitation.deleteMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.user.delete).mockResolvedValue({} as never);

      const result = await permanentlyDeleteUser("target-user");

      expect(result.success).toBe(true);
      // subscription.update must not be called
      expect(prisma.subscription.update).not.toHaveBeenCalled();
    });

    it("prevents deleting a user who is not TERMINATED", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "admin-user", organizationId: "org-1", role: "ADMIN" },
        expires: "",
      });

      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: "target-user",
        email: "active@example.com",
        name: "Active User",
        role: "MEMBER",
        status: "ACTIVE",
        department: "Engineering",
        organizationId: "org-1",
      } as never);

      const result = await permanentlyDeleteUser("target-user");

      expect(result.success).toBe(false);
      expect(result.message).toContain("Only offboarded users");
    });
  });
});
