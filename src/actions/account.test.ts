// src/actions/account.test.ts
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteAccount } from "./account";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      count: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    invitation: {
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockedSignOut = signOut as unknown as ReturnType<typeof vi.fn>;

describe("deleteAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an error for an unauthenticated user", async () => {
    mockedAuth.mockResolvedValueOnce(null);

    const result = await deleteAccount();

    expect(result.success).toBe(false);
    expect(result.error).toBe("Authentication required");
  });

  it("returns an error when the session has no user.id", async () => {
    mockedAuth.mockResolvedValueOnce({ user: {} });

    const result = await deleteAccount();

    expect(result.success).toBe(false);
    expect(result.error).toBe("Authentication required");
  });

  it("prevents the organization's last ADMIN from deleting their account", async () => {
    mockedAuth.mockResolvedValueOnce({
      user: {
        id: "user-1",
        organizationId: "org-1",
        role: "ADMIN",
      },
    });

    vi.mocked(prisma.user.count).mockResolvedValueOnce(0);

    const result = await deleteAccount();

    expect(result.success).toBe(false);
    expect(result.error).toContain("last admin");
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it("lets an ADMIN delete their account when another ADMIN exists", async () => {
    mockedAuth.mockResolvedValueOnce({
      user: {
        id: "user-1",
        organizationId: "org-1",
        role: "ADMIN",
      },
    });

    vi.mocked(prisma.user.count).mockResolvedValueOnce(1); // another ADMIN exists
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      name: "Admin User",
      email: "admin@example.com",
      role: "ADMIN",
      department: "IT",
    } as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValueOnce({} as never);
    vi.mocked(prisma.invitation.deleteMany).mockResolvedValueOnce({
      count: 1,
    } as never);
    vi.mocked(prisma.user.delete).mockResolvedValueOnce({} as never);
    mockedSignOut.mockResolvedValueOnce(undefined);

    await deleteAccount();

    expect(prisma.user.delete).toHaveBeenCalledWith({
      where: { id: "user-1" },
    });
    expect(mockedSignOut).toHaveBeenCalledWith({ redirect: false });
    expect(redirect).toHaveBeenCalledWith("/login?deleted=true");
  });

  it("lets a MEMBER delete their account without the ADMIN check", async () => {
    mockedAuth.mockResolvedValueOnce({
      user: {
        id: "user-2",
        organizationId: "org-1",
        role: "MEMBER",
      },
    });

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      name: "Member User",
      email: "member@example.com",
      role: "MEMBER",
      department: null,
    } as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValueOnce({} as never);
    vi.mocked(prisma.invitation.deleteMany).mockResolvedValueOnce({
      count: 0,
    } as never);
    vi.mocked(prisma.user.delete).mockResolvedValueOnce({} as never);
    mockedSignOut.mockResolvedValueOnce(undefined);

    await deleteAccount();

    // MEMBER does not call user.count
    expect(prisma.user.count).not.toHaveBeenCalled();
    expect(prisma.user.delete).toHaveBeenCalledWith({
      where: { id: "user-2" },
    });
    expect(redirect).toHaveBeenCalledWith("/login?deleted=true");
  });

  it("writes an audit log before deletion (including user info)", async () => {
    mockedAuth.mockResolvedValueOnce({
      user: {
        id: "user-3",
        organizationId: "org-1",
        role: "MEMBER",
      },
    });

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      name: "Test User",
      email: "test@example.com",
      role: "MEMBER",
      department: "Engineering",
    } as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValueOnce({} as never);
    vi.mocked(prisma.invitation.deleteMany).mockResolvedValueOnce({
      count: 0,
    } as never);
    vi.mocked(prisma.user.delete).mockResolvedValueOnce({} as never);
    mockedSignOut.mockResolvedValueOnce(undefined);

    await deleteAccount();

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        userId: "user-3",
        action: "DELETE",
        entityType: "User",
        entityId: "user-3",
        metadata: {
          reason: "self_deletion",
          deletedUserName: "Test User",
          deletedUserEmail: "test@example.com",
          deletedUserRole: "MEMBER",
          deletedUserDepartment: "Engineering",
        },
      },
    });
  });

  it("lets a user without an organizationId delete their account", async () => {
    mockedAuth.mockResolvedValueOnce({
      user: {
        id: "user-4",
        organizationId: null,
        role: "MEMBER",
      },
    });

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      name: "No Org User",
      email: "noorg@example.com",
      role: "MEMBER",
      department: null,
    } as never);
    vi.mocked(prisma.user.delete).mockResolvedValueOnce({} as never);
    mockedSignOut.mockResolvedValueOnce(undefined);

    await deleteAccount();

    // No organizationId, so no audit log is written
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(prisma.user.delete).toHaveBeenCalledWith({
      where: { id: "user-4" },
    });
    expect(redirect).toHaveBeenCalledWith("/login?deleted=true");
  });
});
