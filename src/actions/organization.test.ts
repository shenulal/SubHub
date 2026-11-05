// src/actions/organization.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock modules
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// redirect mock - Next.js redirect throws NEXT_REDIRECT error
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const error = new Error(`NEXT_REDIRECT:${url}`);
    error.name = "NEXT_REDIRECT";
    throw error;
  }),
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createOrganization } from "./organization";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockedAuth = auth as any;

describe("createOrganization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("authentication", () => {
    it("redirects an unauthenticated user to the login page", async () => {
      mockedAuth.mockResolvedValue(null);

      const formData = new FormData();
      formData.set("name", "Test Organization");

      await expect(createOrganization(formData)).rejects.toThrow(
        "NEXT_REDIRECT:/login"
      );
    });

    it("redirects to the login page when the session has no user.id", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "", email: "test@test.com" },
        expires: "",
      });

      const formData = new FormData();
      formData.set("name", "Test Organization");

      await expect(createOrganization(formData)).rejects.toThrow(
        "NEXT_REDIRECT:/login"
      );
    });
  });

  describe("validation", () => {
    it("throws when the organization name is missing", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", email: "test@test.com" },
        expires: "",
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        organizationId: null,
      } as never);

      const formData = new FormData();
      formData.set("name", "");

      await expect(createOrganization(formData)).rejects.toThrow();
    });

    it("throws when the organization name is shorter than 2 characters", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", email: "test@test.com" },
        expires: "",
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        organizationId: null,
      } as never);

      const formData = new FormData();
      formData.set("name", "A");

      await expect(createOrganization(formData)).rejects.toThrow();
    });
  });

  describe("duplicate organization prevention", () => {
    it("throws for a user who already belongs to an organization", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", email: "test@test.com" },
        expires: "",
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        organizationId: "existing-org-id",
      } as never);

      const formData = new FormData();
      formData.set("name", "Test Organization");

      await expect(createOrganization(formData)).rejects.toThrow(
        "You already belong to an organization"
      );
    });
  });

  describe("success cases", () => {
    it("redirects to the dashboard after creating the organization", async () => {
      mockedAuth.mockResolvedValue({
        user: { id: "user-1", email: "test@test.com" },
        expires: "",
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        organizationId: null,
      } as never);

      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
        const tx = {
          organization: {
            create: vi.fn().mockResolvedValue({ id: "new-org-id" }),
          },
          user: {
            update: vi.fn().mockResolvedValue({}),
          },
        };
        return fn(tx as never);
      });

      const formData = new FormData();
      formData.set("name", "Test Organization");

      // redirect throws NEXT_REDIRECT error
      await expect(createOrganization(formData)).rejects.toThrow(
        "NEXT_REDIRECT:/dashboard"
      );
    });

    it("creates the organization and updates the user to ADMIN in a transaction", async () => {
      const mockCreate = vi.fn().mockResolvedValue({ id: "new-org-id" });
      const mockUpdate = vi.fn().mockResolvedValue({});

      mockedAuth.mockResolvedValue({
        user: { id: "user-1", email: "test@test.com" },
        expires: "",
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        organizationId: null,
      } as never);

      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
        const tx = {
          organization: { create: mockCreate },
          user: { update: mockUpdate },
        };
        return fn(tx as never);
      });

      const formData = new FormData();
      formData.set("name", "Test Organization");

      // redirect throws, so we catch and verify the mocks were called
      try {
        await createOrganization(formData);
      } catch (error) {
        // redirect throws NEXT_REDIRECT
        expect((error as Error).message).toContain("NEXT_REDIRECT:/dashboard");
      }

      expect(mockCreate).toHaveBeenCalledWith({
        data: { name: "Test Organization" },
      });

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: {
          organizationId: "new-org-id",
          role: "ADMIN",
        },
      });
    });
  });
});
