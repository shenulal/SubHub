// src/actions/team-members.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Mock Prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
}));

// Mock revalidatePath
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getTeamMembers, removeMember, updateMemberRole } from "./team-members";

describe("team-members actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("updateMemberRole", () => {
    it("returns an error for an unauthenticated user", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const result = await updateMemberRole({
        userId: "user-2",
        role: "ADMIN",
      });

      expect(result).toEqual({
        success: false,
        message: "Authentication required",
      });
    });

    it("returns an error for a user without an organization ID", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: null, role: "ADMIN" },
      } as never);

      const result = await updateMemberRole({
        userId: "user-2",
        role: "ADMIN",
      });

      expect(result).toEqual({
        success: false,
        message: "Organization information is required",
      });
    });

    it("prevents a non-ADMIN user from changing roles", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "MEMBER" },
      } as never);

      const result = await updateMemberRole({
        userId: "user-2",
        role: "ADMIN",
      });

      expect(result).toEqual({
        success: false,
        message: "Only admins can change roles",
      });
    });

    it("prevents users from changing their own role", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      const result = await updateMemberRole({
        userId: "user-1",
        role: "MEMBER",
      });

      expect(result).toEqual({
        success: false,
        message: "You cannot change your own role",
      });
    });

    it("returns an error for a non-existent user", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

      const result = await updateMemberRole({
        userId: "user-2",
        role: "ADMIN",
      });

      expect(result).toEqual({
        success: false,
        message: "Team member not found",
      });
    });

    it("changes a team member's role successfully", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: "user-2",
        organizationId: "org-1",
        role: "MEMBER",
      } as never);

      vi.mocked(prisma.user.update).mockResolvedValue({
        id: "user-2",
        role: "ADMIN",
      } as never);

      const result = await updateMemberRole({
        userId: "user-2",
        role: "ADMIN",
      });

      expect(result.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-2" },
        data: { role: "ADMIN" },
      });
      expect(revalidatePath).toHaveBeenCalledWith("/settings/team");
    });
  });

  describe("removeMember", () => {
    it("returns an error for an unauthenticated user", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const result = await removeMember("user-2");

      expect(result).toEqual({
        success: false,
        message: "Authentication required",
      });
    });

    it("prevents a non-ADMIN user from removing team members", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "MEMBER" },
      } as never);

      const result = await removeMember("user-2");

      expect(result).toEqual({
        success: false,
        message: "Only admins can remove team members",
      });
    });

    it("prevents users from removing themselves", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      const result = await removeMember("user-1");

      expect(result).toEqual({
        success: false,
        message: "You cannot remove yourself",
      });
    });

    it("prevents removing the organization's last admin", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: "user-2",
        organizationId: "org-1",
        role: "ADMIN",
      } as never);

      vi.mocked(prisma.user.count).mockResolvedValue(1);

      const result = await removeMember("user-2");

      expect(result).toEqual({
        success: false,
        message: "The organization's last admin cannot be removed",
      });
    });

    it("removes a team member successfully", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: "user-2",
        organizationId: "org-1",
        role: "MEMBER",
      } as never);

      vi.mocked(prisma.user.update).mockResolvedValue({
        id: "user-2",
        organizationId: null,
      } as never);

      const result = await removeMember("user-2");

      expect(result.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-2" },
        data: {
          organizationId: null,
          role: "VIEWER",
        },
      });
      expect(revalidatePath).toHaveBeenCalledWith("/settings/team");
    });
  });

  describe("getTeamMembers", () => {
    it("returns an error for an unauthenticated user", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const result = await getTeamMembers();

      expect(result).toEqual({
        success: false,
        message: "Authentication required",
      });
    });

    it("returns all team members of the organization", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      const mockMembers = [
        {
          id: "user-1",
          name: "Admin User",
          email: "admin@example.com",
          role: "ADMIN",
          status: "ACTIVE",
          image: null,
          lastLoginAt: new Date(),
          createdAt: new Date(),
        },
        {
          id: "user-2",
          name: "Member User",
          email: "member@example.com",
          role: "MEMBER",
          status: "ACTIVE",
          image: null,
          lastLoginAt: new Date(),
          createdAt: new Date(),
        },
      ];

      vi.mocked(prisma.user.findMany).mockResolvedValue(mockMembers as never);

      const result = await getTeamMembers();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockMembers);
    });
  });
});
