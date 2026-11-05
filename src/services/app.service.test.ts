// src/services/app.service.test.ts
// TDD RED: service layer tests — written before the implementation
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    app: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    appTeam: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
    team: {
      findMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/services/payment/payment-matching", () => ({
  matchPaymentsToNewApp: vi.fn().mockResolvedValue({ matchedCount: 0 }),
}));

import { prisma } from "@/lib/db";
import {
  createApp,
  deleteApp,
  updateApp,
  type AppServiceContext,
} from "./app.service";

const mockCtx: AppServiceContext = {
  organizationId: "org-1",
  userId: "user-1",
  role: "ADMIN",
};

describe("AppService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ==================== createApp ====================
  describe("createApp", () => {
    it("creates an app successfully", async () => {
      vi.mocked(prisma.app.findFirst).mockResolvedValue(null); // no duplicate
      vi.mocked(prisma.app.create).mockResolvedValue({
        id: "app-new",
        name: "Slack",
        organizationId: "org-1",
      } as never);

      const result = await createApp(mockCtx, {
        name: "Slack",
      });

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe("app-new");
      expect(prisma.app.create).toHaveBeenCalledOnce();
      expect(prisma.auditLog.create).toHaveBeenCalledOnce();
    });

    it("fails when the app name is a duplicate", async () => {
      vi.mocked(prisma.app.findFirst).mockResolvedValue({
        id: "existing",
        name: "Slack",
      } as never);

      const result = await createApp(mockCtx, {
        name: "Slack",
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("already exists");
      expect(prisma.app.create).not.toHaveBeenCalled();
    });

    it("fails for a VIEWER role", async () => {
      const viewerCtx = { ...mockCtx, role: "VIEWER" };

      const result = await createApp(viewerCtx, {
        name: "Slack",
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("permission");
    });

    it("includes category, website, notes and tags", async () => {
      vi.mocked(prisma.app.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.app.create).mockResolvedValue({
        id: "app-new",
        name: "Figma",
        organizationId: "org-1",
      } as never);

      const result = await createApp(mockCtx, {
        name: "Figma",
        category: "Design",
        customWebsite: "https://figma.com",
        notes: "Design tool",
        tags: "design,ui",
      });

      expect(result.success).toBe(true);
      expect(prisma.app.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "Figma",
            category: "Design",
            customWebsite: "https://figma.com",
            notes: "Design tool",
            tags: ["design", "ui"],
          }),
        })
      );
    });

    it("creates AppTeam records when teamIds are given", async () => {
      vi.mocked(prisma.app.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.team.findMany).mockResolvedValue([
        { id: "team-1" },
        { id: "team-2" },
      ] as never);
      vi.mocked(prisma.app.create).mockResolvedValue({
        id: "app-new",
        name: "Slack",
        organizationId: "org-1",
      } as never);

      const result = await createApp(mockCtx, {
        name: "Slack",
        teamIds: ["team-1", "team-2"],
      });

      expect(result.success).toBe(true);
      expect(prisma.appTeam.createMany).toHaveBeenCalledWith({
        data: [
          { appId: "app-new", teamId: "team-1", assignedBy: "user-1" },
          { appId: "app-new", teamId: "team-2", assignedBy: "user-1" },
        ],
      });
    });

    it("fails when teamIds are invalid", async () => {
      vi.mocked(prisma.app.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.team.findMany).mockResolvedValue([
        { id: "team-1" },
      ] as never); // only 1 of 2 found

      const result = await createApp(mockCtx, {
        name: "Slack",
        teamIds: ["team-1", "team-invalid"],
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("teams are invalid");
    });

    it("validates ownerId — fails when the owner is not in the organization", async () => {
      vi.mocked(prisma.app.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null); // owner not found

      const result = await createApp(mockCtx, {
        name: "Slack",
        ownerId: "unknown-user",
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("owner");
    });
  });

  // ==================== updateApp ====================
  describe("updateApp", () => {
    it("updates an app successfully", async () => {
      vi.mocked(prisma.app.findFirst)
        .mockResolvedValueOnce({
          id: "app-1",
          name: "Slack",
          status: "ACTIVE",
          organizationId: "org-1",
        } as never)
        .mockResolvedValueOnce(null); // no duplicate name
      vi.mocked(prisma.app.update).mockResolvedValue({
        id: "app-1",
        name: "Slack Pro",
      } as never);

      const result = await updateApp(mockCtx, "app-1", {
        name: "Slack Pro",
      });

      expect(result.success).toBe(true);
      expect(prisma.app.update).toHaveBeenCalledOnce();
    });

    it("fails when the app does not exist", async () => {
      vi.mocked(prisma.app.findFirst).mockResolvedValue(null);

      const result = await updateApp(mockCtx, "nonexistent", {
        name: "New Name",
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("not found");
    });

    it("fails when the user is not an ADMIN", async () => {
      const memberCtx = { ...mockCtx, role: "MEMBER" };

      const result = await updateApp(memberCtx, "app-1", {
        name: "New",
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("permission");
    });

    it("fails when renaming to a duplicate app name", async () => {
      vi.mocked(prisma.app.findFirst)
        .mockResolvedValueOnce({
          id: "app-1",
          name: "Slack",
          status: "ACTIVE",
          organizationId: "org-1",
        } as never)
        .mockResolvedValueOnce({
          id: "app-2",
          name: "Notion",
        } as never); // duplicate exists

      const result = await updateApp(mockCtx, "app-1", {
        name: "Notion",
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("already exists");
    });
  });

  // ==================== deleteApp ====================
  describe("deleteApp", () => {
    it("deletes an app successfully", async () => {
      vi.mocked(prisma.app.findFirst).mockResolvedValue({
        id: "app-1",
        name: "Slack",
        organizationId: "org-1",
      } as never);

      const result = await deleteApp(mockCtx, "app-1");

      expect(result.success).toBe(true);
      expect(prisma.app.delete).toHaveBeenCalledWith({
        where: { id: "app-1" },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledOnce();
    });

    it("fails when the app does not exist", async () => {
      vi.mocked(prisma.app.findFirst).mockResolvedValue(null);

      const result = await deleteApp(mockCtx, "nonexistent");

      expect(result.success).toBe(false);
      expect(result.message).toContain("not found");
    });

    it("fails when the user is not an ADMIN", async () => {
      const memberCtx = { ...mockCtx, role: "MEMBER" };

      const result = await deleteApp(memberCtx, "app-1");

      expect(result.success).toBe(false);
      expect(result.message).toContain("permission");
    });
  });
});
