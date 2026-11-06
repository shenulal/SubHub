// src/actions/bulk-import.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock auth
vi.mock("@/lib/rbac/service", async () =>
  (await import("@/test/rbac-session-mock")).sessionRbacMock()
);
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Mock Prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    app: {
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
    category: {
      findMany: vi.fn().mockResolvedValue([
        { id: "c-collab", name: "Collaboration", slug: "collaboration" },
        { id: "c-prod", name: "Productivity", slug: "productivity" },
      ]),
    },
    subscription: {
      createMany: vi.fn(),
    },
    user: {
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn((fn) => fn()),
  },
}));

// Mock revalidatePath
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import {
  bulkImportApps,
  bulkImportSubscriptions,
  bulkImportUsers,
} from "./bulk-import";

describe("bulk-import actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("bulkImportApps", () => {
    it("returns an error for an unauthenticated user", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const result = await bulkImportApps("name,category\nSlack,COLLABORATION");

      expect(result).toEqual({
        success: false,
        message: "Authentication required",
      });
    });

    it("returns an error for a user without an organization ID", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: null, role: "ADMIN" },
      } as never);

      const result = await bulkImportApps("name,category\nSlack,COLLABORATION");

      expect(result).toEqual({
        success: false,
        message: "Organization information is required",
      });
    });

    it("prevents a non-ADMIN user from bulk importing", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "MEMBER" },
      } as never);

      const result = await bulkImportApps("name,category\nSlack,COLLABORATION");

      expect(result).toEqual({
        success: false,
        message: "Only admins can bulk import",
      });
    });

    it("bulk imports apps from a valid CSV", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      vi.mocked(prisma.app.createMany).mockResolvedValue({ count: 2 });

      const csv = `name,category,vendor,description,website
Slack,COLLABORATION,Slack Inc,Team communication,https://slack.com
Notion,PRODUCTIVITY,Notion Labs,Workspace tool,https://notion.so`;

      const result = await bulkImportApps(csv);

      expect(result.success).toBe(true);
      expect(result.data?.created).toBe(2);
      expect(prisma.app.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            name: "Slack",
            category: "Collaboration",
            categoryId: "c-collab",
            notes: "Slack Inc - Team communication",
            customWebsite: "https://slack.com",
            organizationId: "org-1",
            ownerId: "user-1",
            source: "CSV_IMPORT",
          }),
          expect.objectContaining({
            name: "Notion",
            category: "Productivity",
            notes: "Notion Labs - Workspace tool",
            customWebsite: "https://notion.so",
          }),
        ]),
        skipDuplicates: true,
      });
      expect(revalidatePath).toHaveBeenCalledWith("/apps");
    });

    it("returns CSV validation errors", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      const csv = `name,category
,COLLABORATION
Notion,INVALID_CATEGORY`;

      const result = await bulkImportApps(csv);

      expect(result.success).toBe(false);
      expect(result.data?.errors).toHaveLength(2);
    });

    it("returns an error for an empty CSV", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      const result = await bulkImportApps("name,category");

      expect(result).toEqual({
        success: false,
        message: "There is no data to import",
      });
    });
  });

  describe("bulkImportSubscriptions", () => {
    it("returns an error for an unauthenticated user", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const result = await bulkImportSubscriptions(
        "appName,planName,billingCycle\nSlack,Business,MONTHLY"
      );

      expect(result).toEqual({
        success: false,
        message: "Authentication required",
      });
    });

    it("bulk imports subscriptions from a valid CSV", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      vi.mocked(prisma.app.findMany).mockResolvedValue([
        { id: "app-1", name: "Slack" },
        { id: "app-2", name: "Notion" },
      ] as never);

      vi.mocked(prisma.subscription.createMany).mockResolvedValue({ count: 2 });

      const csv = `appName,planName,billingCycle,price
Slack,Business+,MONTHLY,100000
Notion,Team,YEARLY,120000`;

      const result = await bulkImportSubscriptions(csv);

      expect(result.success).toBe(true);
      expect(result.data?.created).toBe(2);
      expect(revalidatePath).toHaveBeenCalledWith("/subscriptions");
    });

    it("treats subscriptions for non-existent apps as errors", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      vi.mocked(prisma.app.findMany).mockResolvedValue([
        { id: "app-1", name: "Slack" },
      ] as never);

      const csv = `appName,planName,billingCycle
Slack,Business,MONTHLY
NonExistentApp,Plan,MONTHLY`;

      const result = await bulkImportSubscriptions(csv);

      expect(result.data?.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringContaining("NonExistentApp"),
        })
      );
    });
  });

  describe("bulkImportUsers", () => {
    it("returns an error for an unauthenticated user", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const result = await bulkImportUsers(
        "email,name,role\njohn@example.com,John,MEMBER"
      );

      expect(result).toEqual({
        success: false,
        message: "Authentication required",
      });
    });

    it("returns an error when there is no organization info", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: null, role: "ADMIN" },
      } as never);

      const result = await bulkImportUsers(
        "email,name,role\njohn@example.com,John,MEMBER"
      );

      expect(result).toEqual({
        success: false,
        message: "Organization information is required",
      });
    });

    it("returns an error for a non-ADMIN user", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "MEMBER" },
      } as never);

      const result = await bulkImportUsers(
        "email,name,role\njohn@example.com,John,MEMBER"
      );

      expect(result).toEqual({
        success: false,
        message: "Only admins can bulk import",
      });
    });

    it("returns an error for an empty CSV", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      const result = await bulkImportUsers("email,name,role");

      expect(result).toEqual({
        success: false,
        message: "There is no data to import",
      });
    });

    it("bulk imports users from a valid CSV", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      // no existing users
      vi.mocked(prisma.user.findMany).mockResolvedValue([]);
      vi.mocked(prisma.user.createMany).mockResolvedValue({ count: 2 });
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      const csv = `email,name,role,department,jobTitle,employeeId
john@example.com,John Doe,MEMBER,Engineering,Software Engineer,EMP001
jane@example.com,Jane Smith,ADMIN,HR,HR Manager,EMP002`;

      const result = await bulkImportUsers(csv);

      expect(result.success).toBe(true);
      expect(result.data?.created).toBe(2);
      expect(prisma.user.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            email: "john@example.com",
            name: "John Doe",
            role: "MEMBER",
            department: "Engineering",
            jobTitle: "Software Engineer",
            employeeId: "EMP001",
            organizationId: "org-1",
            status: "ACTIVE",
          }),
          expect.objectContaining({
            email: "jane@example.com",
            name: "Jane Smith",
            role: "ADMIN",
          }),
        ]),
        skipDuplicates: true,
      });
      expect(revalidatePath).toHaveBeenCalledWith("/users");
      expect(revalidatePath).toHaveBeenCalledWith("/settings/team");
    });

    it("returns CSV validation errors", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      const csv = `email,name,role
,John,MEMBER
jane@example.com,Jane,SUPERADMIN`;

      const result = await bulkImportUsers(csv);

      expect(result.success).toBe(false);
      expect(result.data?.errors).toHaveLength(2);
    });

    it("skips existing user emails", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      // john@example.com already exists
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: "existing-user", email: "john@example.com" },
      ] as never);
      vi.mocked(prisma.user.createMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      const csv = `email,name,role
john@example.com,John Doe,MEMBER
jane@example.com,Jane Smith,ADMIN`;

      const result = await bulkImportUsers(csv);

      expect(result.success).toBe(true);
      expect(result.data?.created).toBe(1);
      expect(result.data?.errors).toHaveLength(1);
      expect(result.data?.errors?.[0].message).toContain("already exists");
    });

    it("writes an audit log", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      vi.mocked(prisma.user.findMany).mockResolvedValue([]);
      vi.mocked(prisma.user.createMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      const csv = `email,name,role
john@example.com,John Doe,MEMBER`;

      await bulkImportUsers(csv);

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "BULK_IMPORT_USERS",
          entityType: "User",
          userId: "user-1",
          organizationId: "org-1",
          metadata: expect.objectContaining({
            totalRows: 1,
            createdCount: 1,
          }),
        }),
      });
    });

    it("refreshes the cache", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      vi.mocked(prisma.user.findMany).mockResolvedValue([]);
      vi.mocked(prisma.user.createMany).mockResolvedValue({ count: 1 });
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      const csv = `email,name,role
john@example.com,John Doe,MEMBER`;

      await bulkImportUsers(csv);

      expect(revalidatePath).toHaveBeenCalledWith("/users");
      expect(revalidatePath).toHaveBeenCalledWith("/settings/team");
    });
  });
});
