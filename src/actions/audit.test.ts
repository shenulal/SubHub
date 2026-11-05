// src/actions/audit.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// Auth mock
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Prisma mock
vi.mock("@/lib/db", () => ({
  prisma: {
    auditLog: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    team: {
      findMany: vi.fn(),
    },
  },
}));

// redirect mock
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const error = new Error(`NEXT_REDIRECT:${url}`);
    error.name = "NEXT_REDIRECT";
    throw error;
  }),
}));

describe("audit actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAuditLogs", () => {
    it("should redirect when not authenticated", async () => {
      const { auth } = await import("@/lib/auth");
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const { getAuditLogs } = await import("./audit");
      await expect(getAuditLogs({})).rejects.toThrow("NEXT_REDIRECT:/login");
    });

    it("should return audit logs with pagination", async () => {
      const { auth } = await import("@/lib/auth");
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1" },
      });

      const mockLogs = [
        {
          id: "log-1",
          action: "CREATE",
          entityType: "App",
          entityId: "app-1",
          userId: "user-1",
          user: { name: "Tester", email: "test@example.com" },
          changes: { name: "New App" },
          metadata: null,
          ipAddress: "127.0.0.1",
          userAgent: "Mozilla/5.0",
          createdAt: new Date("2024-11-30T10:00:00Z"),
        },
      ];

      const { prisma } = await import("@/lib/db");
      (prisma.auditLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockLogs
      );
      (prisma.auditLog.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const { getAuditLogs } = await import("./audit");
      const result = await getAuditLogs({});

      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].action).toBe("CREATE");
      expect(result.pagination.total).toBe(1);
      // Dates are serialized as ISO strings
      expect(typeof result.logs[0].createdAt).toBe("string");
    });

    it("should apply filters correctly", async () => {
      const { auth } = await import("@/lib/auth");
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1" },
      });

      const { prisma } = await import("@/lib/db");
      (prisma.auditLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        []
      );
      (prisma.auditLog.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const { getAuditLogs } = await import("./audit");
      await getAuditLogs({
        action: "CREATE",
        userId: "user-1",
        entityType: "App",
        startDate: "2024-11-01T00:00:00Z",
        endDate: "2024-11-30T23:59:59Z",
        page: 1,
        limit: 20,
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: "org-1",
            action: { startsWith: "CREATE" },
            userId: "user-1",
            entityType: "App",
          }),
          take: 20,
          skip: 0,
        })
      );
    });

    it("should apply search filter", async () => {
      const { auth } = await import("@/lib/auth");
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1" },
      });

      const { prisma } = await import("@/lib/db");
      (prisma.auditLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        []
      );
      (prisma.auditLog.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const { getAuditLogs } = await import("./audit");
      await getAuditLogs({ search: "Test" });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                user: { name: { contains: "Test", mode: "insensitive" } },
              }),
            ]),
          }),
        })
      );
    });

    it("should apply team filter", async () => {
      const { auth } = await import("@/lib/auth");
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      });

      const { prisma } = await import("@/lib/db");
      (prisma.auditLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
        []
      );
      (prisma.auditLog.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);

      const { getAuditLogs } = await import("./audit");
      await getAuditLogs({ teamId: "team-1" });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            user: { teamId: "team-1" },
          }),
        })
      );
    });
  });

  describe("getAuditLogs multi-select filters", () => {
    async function whereFor(filters: Record<string, unknown>) {
      const { auth } = await import("@/lib/auth");
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: { id: "admin-1", organizationId: "org-1", role: "ADMIN" },
      });
      const { prisma } = await import("@/lib/db");
      const findMany = prisma.auditLog.findMany as ReturnType<typeof vi.fn>;
      findMany.mockResolvedValue([]);
      (prisma.auditLog.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
      const { getAuditLogs } = await import("./audit");
      await getAuditLogs(filters);
      return findMany.mock.calls.at(-1)![0].where as Record<string, unknown>;
    }

    it("matches any of several actions (prefix) with other facets as `in`", async () => {
      const where = await whereFor({
        actions: ["CREATE", "DELETE"],
        userIds: ["u1", "u2"],
        entityTypes: ["App", "Subscription"],
        teamIds: ["t1", "t2"],
      });
      expect(where.AND).toEqual([
        {
          OR: [
            { action: { startsWith: "CREATE" } },
            { action: { startsWith: "DELETE" } },
          ],
        },
      ]);
      expect(where.action).toBeUndefined();
      expect(where.userId).toEqual({ in: ["u1", "u2"] });
      expect(where.entityType).toEqual({ in: ["App", "Subscription"] });
      expect(where.user).toEqual({ teamId: { in: ["t1", "t2"] } });
    });

    it("keeps the legacy single values working", async () => {
      const where = await whereFor({ action: "LOGIN", entityType: "User" });
      expect(where.action).toEqual({ startsWith: "LOGIN" });
      expect(where.entityType).toBe("User");
    });

    it("treats empty lists as no filter", async () => {
      const where = await whereFor({
        actions: [],
        userIds: [],
        entityTypes: [],
        teamIds: [],
      });
      expect(where).toEqual({ organizationId: "org-1" });
    });

    it("keeps search OR and multi-action AND apart", async () => {
      const where = await whereFor({
        actions: ["CREATE", "UPDATE"],
        search: "slack",
      });
      expect(Array.isArray(where.OR)).toBe(true);
      expect(where.AND).toHaveLength(1);
    });
  });

  describe("getAuditLogById", () => {
    it("should redirect when not authenticated", async () => {
      const { auth } = await import("@/lib/auth");
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const { getAuditLogById } = await import("./audit");
      await expect(getAuditLogById("log-1")).rejects.toThrow(
        "NEXT_REDIRECT:/login"
      );
    });

    it("should return null when log not found", async () => {
      const { auth } = await import("@/lib/auth");
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1" },
      });

      const { prisma } = await import("@/lib/db");
      (
        prisma.auditLog.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const { getAuditLogById } = await import("./audit");
      const result = await getAuditLogById("non-existent");

      expect(result).toBeNull();
    });

    it("should throw error when accessing other organization log", async () => {
      const { auth } = await import("@/lib/auth");
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1" },
      });

      const { prisma } = await import("@/lib/db");
      (
        prisma.auditLog.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: "log-1",
        organizationId: "org-2", // different organization
      });

      const { getAuditLogById } = await import("./audit");
      await expect(getAuditLogById("log-1")).rejects.toThrow(
        "You do not have access permission"
      );
    });

    it("should return audit log detail", async () => {
      const { auth } = await import("@/lib/auth");
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1" },
      });

      const mockLog = {
        id: "log-1",
        organizationId: "org-1",
        action: "UPDATE",
        entityType: "Subscription",
        entityId: "sub-1",
        userId: "user-1",
        user: { name: "Administrator", email: "admin@example.com" },
        changes: { status: { from: "ACTIVE", to: "CANCELLED" } },
        metadata: { reason: "User request" },
        ipAddress: "192.168.1.1",
        userAgent: "Chrome/120",
        createdAt: new Date("2024-11-30T15:00:00Z"),
      };

      const { prisma } = await import("@/lib/db");
      (
        prisma.auditLog.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockLog);

      const { getAuditLogById } = await import("./audit");
      const result = await getAuditLogById("log-1");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("log-1");
      expect(result?.action).toBe("UPDATE");
      expect(result?.changes).toEqual({
        status: { from: "ACTIVE", to: "CANCELLED" },
      });
    });
  });

  describe("getAuditLogFilterOptions", () => {
    it("should redirect when not authenticated", async () => {
      const { auth } = await import("@/lib/auth");
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const { getAuditLogFilterOptions } = await import("./audit");
      await expect(getAuditLogFilterOptions()).rejects.toThrow(
        "NEXT_REDIRECT:/login"
      );
    });

    it("should return filter options", async () => {
      const { auth } = await import("@/lib/auth");
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      });

      const { prisma } = await import("@/lib/db");
      (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: "user-1",
          name: "User 1",
          email: "user1@example.com",
          teamId: "team-1",
          team: { id: "team-1", name: "Marketing" },
        },
        {
          id: "user-2",
          name: "User 2",
          email: "user2@example.com",
          teamId: null,
          team: null,
        },
      ]);
      (prisma.team.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "team-1", name: "Marketing" },
      ]);

      const { getAuditLogFilterOptions } = await import("./audit");
      const result = await getAuditLogFilterOptions();

      expect(result.actions).toContain("CREATE");
      expect(result.actions).toContain("UPDATE");
      expect(result.actions).toContain("DELETE");
      expect(result.entityTypes).toContain("App");
      expect(result.entityTypes).toContain("Subscription");
      expect(result.users).toHaveLength(2);
      expect(result.teams).toHaveLength(1);
    });
  });

  describe("getAuditLogExportData", () => {
    it("should return export logs with team name", async () => {
      const { auth } = await import("@/lib/auth");
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      });

      const { prisma } = await import("@/lib/db");
      (prisma.auditLog.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: "log-1",
          action: "EXPORT",
          entityType: "Report",
          entityId: null,
          userId: "user-1",
          user: {
            name: "Administrator",
            email: "admin@example.com",
            team: { name: "Marketing" },
          },
          changes: null,
          metadata: null,
          ipAddress: "127.0.0.1",
          userAgent: "Mozilla/5.0",
          createdAt: new Date("2024-11-30T10:00:00Z"),
        },
      ]);

      const { getAuditLogExportData } = await import("./audit");
      const result = await getAuditLogExportData({});

      expect(result).toHaveLength(1);
      expect(result[0].teamName).toBe("Marketing");
      expect(result[0].action).toBe("EXPORT");
    });
  });
});
