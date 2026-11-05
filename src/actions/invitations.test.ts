// src/actions/invitations.test.ts
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
    invitation: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
}));

// Mock email service
vi.mock("@/lib/services/notification/email", () => ({
  sendInvitationEmail: vi.fn(),
}));

// Mock revalidatePath
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendInvitationEmail } from "@/lib/services/notification/email";
import { revalidatePath } from "next/cache";
import {
  acceptInvitation,
  cancelInvitation,
  createInvitation,
  getInvitations,
  resendInvitation,
} from "./invitations";

describe("invitations actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createInvitation", () => {
    it("returns an error for an unauthenticated user", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const result = await createInvitation({
        email: "newuser@example.com",
        role: "MEMBER",
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

      const result = await createInvitation({
        email: "newuser@example.com",
        role: "MEMBER",
      });

      expect(result).toEqual({
        success: false,
        message: "Organization information is required",
      });
    });

    it("prevents a non-ADMIN user from inviting", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "MEMBER" },
      } as never);

      const result = await createInvitation({
        email: "newuser@example.com",
        role: "MEMBER",
      });

      expect(result).toEqual({
        success: false,
        message: "You do not have permission to invite members",
      });
    });

    it("cannot invite a user who already belongs to the organization", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        id: "existing-user",
        email: "newuser@example.com",
      } as never);

      const result = await createInvitation({
        email: "newuser@example.com",
        role: "MEMBER",
      });

      expect(result).toEqual({
        success: false,
        message: "This user already belongs to the organization",
      });
    });

    it("returns an error when a pending invitation exists", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.invitation.findFirst).mockResolvedValue({
        id: "inv-1",
        email: "newuser@example.com",
        status: "PENDING",
      } as never);

      const result = await createInvitation({
        email: "newuser@example.com",
        role: "MEMBER",
      });

      expect(result).toEqual({
        success: false,
        message: "A pending invitation already exists",
      });
    });

    it("creates a new invitation", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.invitation.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.invitation.create).mockResolvedValue({
        id: "inv-1",
        email: "newuser@example.com",
        role: "MEMBER",
        token: "test-token",
        organization: { name: "Test Organization" },
        invitedBy: { name: "Admin User" },
      } as never);
      vi.mocked(sendInvitationEmail).mockResolvedValue({ success: true });

      const result = await createInvitation({
        email: "newuser@example.com",
        role: "MEMBER",
      });

      expect(result.success).toBe(true);
      expect(prisma.invitation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: "newuser@example.com",
          role: "MEMBER",
          organizationId: "org-1",
          invitedById: "user-1",
          status: "PENDING",
        }),
        include: expect.objectContaining({
          organization: true,
          invitedBy: true,
        }),
      });
    });

    it("sends an email after creating the invitation", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.invitation.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.invitation.create).mockResolvedValue({
        id: "inv-1",
        email: "newuser@example.com",
        role: "MEMBER",
        token: "test-token",
        organization: { name: "Test Organization" },
        invitedBy: { name: "Admin User" },
      } as never);
      vi.mocked(sendInvitationEmail).mockResolvedValue({ success: true });

      await createInvitation({
        email: "newuser@example.com",
        role: "MEMBER",
      });

      expect(sendInvitationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "newuser@example.com",
          token: "test-token",
        })
      );
    });

    it("calls revalidatePath after creating the invitation", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.invitation.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.invitation.create).mockResolvedValue({
        id: "inv-1",
        email: "newuser@example.com",
        token: "test-token",
        organization: { name: "Test Organization" },
        invitedBy: { name: "Admin User" },
      } as never);
      vi.mocked(sendInvitationEmail).mockResolvedValue({ success: true });

      await createInvitation({
        email: "newuser@example.com",
        role: "MEMBER",
      });

      expect(revalidatePath).toHaveBeenCalledWith("/settings/team");
    });
  });

  describe("getInvitations", () => {
    it("returns an error for an unauthenticated user", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const result = await getInvitations();

      expect(result).toEqual({
        success: false,
        message: "Authentication required",
      });
    });

    it("returns all invitations of the organization", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      const mockInvitations = [
        {
          id: "inv-1",
          email: "user1@example.com",
          role: "MEMBER",
          status: "PENDING",
          createdAt: new Date(),
          expiresAt: new Date(),
          invitedBy: { name: "Admin User" },
        },
      ];

      vi.mocked(prisma.invitation.findMany).mockResolvedValue(
        mockInvitations as never
      );

      const result = await getInvitations();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockInvitations);
    });
  });

  describe("cancelInvitation", () => {
    it("returns an error for an unauthenticated user", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const result = await cancelInvitation("inv-1");

      expect(result).toEqual({
        success: false,
        message: "Authentication required",
      });
    });

    it("returns an error for a non-existent invitation", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      vi.mocked(prisma.invitation.findFirst).mockResolvedValue(null);

      const result = await cancelInvitation("inv-1");

      expect(result).toEqual({
        success: false,
        message: "Invitation not found",
      });
    });

    it("cancels the invitation", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      vi.mocked(prisma.invitation.findFirst).mockResolvedValue({
        id: "inv-1",
        organizationId: "org-1",
        status: "PENDING",
      } as never);

      vi.mocked(prisma.invitation.update).mockResolvedValue({
        id: "inv-1",
        status: "CANCELLED",
      } as never);

      const result = await cancelInvitation("inv-1");

      expect(result.success).toBe(true);
      expect(prisma.invitation.update).toHaveBeenCalledWith({
        where: { id: "inv-1" },
        data: { status: "CANCELLED" },
      });
    });
  });

  describe("resendInvitation", () => {
    it("returns an error for an unauthenticated user", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const result = await resendInvitation("inv-1");

      expect(result).toEqual({
        success: false,
        message: "Authentication required",
      });
    });

    it("returns an error for an invitation that is not pending", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      vi.mocked(prisma.invitation.findFirst).mockResolvedValue({
        id: "inv-1",
        status: "ACCEPTED",
      } as never);

      const result = await resendInvitation("inv-1");

      expect(result).toEqual({
        success: false,
        message: "Only pending invitations can be resent",
      });
    });

    it("resends the invitation email", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      vi.mocked(prisma.invitation.findFirst).mockResolvedValue({
        id: "inv-1",
        email: "user@example.com",
        token: "test-token",
        status: "PENDING",
        organizationId: "org-1",
        organization: { name: "Test Organization" },
        invitedBy: { name: "Admin User" },
      } as never);

      vi.mocked(prisma.invitation.update).mockResolvedValue({
        id: "inv-1",
        email: "user@example.com",
        token: "new-token",
        role: "MEMBER",
        organization: { name: "Test Organization" },
        invitedBy: { name: "Admin User" },
      } as never);

      vi.mocked(sendInvitationEmail).mockResolvedValue({ success: true });

      const result = await resendInvitation("inv-1");

      expect(result.success).toBe(true);
      expect(sendInvitationEmail).toHaveBeenCalled();
    });

    it("resends when called with FormData", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
      } as never);

      vi.mocked(prisma.invitation.findFirst).mockResolvedValue({
        id: "inv-1",
        email: "user@example.com",
        token: "test-token",
        status: "PENDING",
        organizationId: "org-1",
        organization: { name: "Test Organization" },
        invitedBy: { name: "Admin User" },
      } as never);

      vi.mocked(prisma.invitation.update).mockResolvedValue({
        id: "inv-1",
        email: "user@example.com",
        token: "new-token",
        role: "MEMBER",
        organization: { name: "Test Organization" },
        invitedBy: { name: "Admin User" },
      } as never);

      const formData = new FormData();
      formData.set("invitationId", "inv-1");

      const result = await resendInvitation(formData);

      expect(result.success).toBe(true);
      expect(prisma.invitation.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "inv-1" } })
      );
    });
  });

  describe("acceptInvitation", () => {
    it("returns an error for an invalid token", async () => {
      vi.mocked(prisma.invitation.findFirst).mockResolvedValue(null);

      const result = await acceptInvitation("invalid-token");

      expect(result).toEqual({
        success: false,
        message: "Invalid invitation",
      });
    });

    it("returns an error for an expired invitation", async () => {
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1);

      vi.mocked(prisma.invitation.findFirst).mockResolvedValue({
        id: "inv-1",
        token: "test-token",
        status: "PENDING",
        expiresAt: expiredDate,
      } as never);

      const result = await acceptInvitation("test-token");

      expect(result).toEqual({
        success: false,
        message: "The invitation has expired",
      });
    });

    it("accepts the invitation and adds the user to the organization", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", email: "user@example.com" },
      } as never);

      vi.mocked(prisma.invitation.findFirst).mockResolvedValue({
        id: "inv-1",
        token: "test-token",
        status: "PENDING",
        email: "user@example.com",
        role: "MEMBER",
        organizationId: "org-1",
        expiresAt: futureDate,
      } as never);

      vi.mocked(prisma.invitation.update).mockResolvedValue({
        id: "inv-1",
        status: "ACCEPTED",
      } as never);

      vi.mocked(prisma.user.update).mockResolvedValue({
        id: "user-1",
        organizationId: "org-1",
      } as never);

      const result = await acceptInvitation("test-token");

      expect(result.success).toBe(true);
      expect(prisma.invitation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "inv-1" },
          data: expect.objectContaining({ status: "ACCEPTED" }),
        })
      );
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: {
          organizationId: "org-1",
          role: "MEMBER",
        },
      });
    });
  });
});
