// src/actions/organization-update.test.ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { describe, expect, it, vi } from "vitest";
import { updateOrganization } from "./organization";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// RBAC: permissions follow the mocked session's system role.
vi.mock("@/lib/rbac/service", async () =>
  (await import("@/test/rbac-session-mock")).sessionRbacMock()
);

vi.mock("@/lib/db", () => ({
  prisma: {
    organization: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// redirect mock
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    const error = new Error(`NEXT_REDIRECT:${url}`);
    error.name = "NEXT_REDIRECT";
    throw error;
  },
}));

describe("updateOrganization", () => {
  it("redirects to /login when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never);

    const formData = new FormData();
    formData.set("name", "Organization");

    await expect(updateOrganization(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/login"
    );
  });

  it("redirects to /onboarding when there is no organization", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "user-1", organizationId: null, role: "ADMIN" },
    } as never);

    const formData = new FormData();
    formData.set("name", "Organization");

    await expect(updateOrganization(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/onboarding"
    );
  });

  it("returns a failure message for a non-admin", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "user-1", organizationId: "org-1", role: "MEMBER" },
    } as never);

    const formData = new FormData();
    formData.set("name", "Organization");

    const result = await updateOrganization(formData);
    expect(result.success).toBe(false);
    expect(result.message).toBe("Only admins can update organization details");
  });

  it("updates the organization name", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
    } as never);

    vi.mocked(prisma.organization.findUnique).mockResolvedValueOnce({
      settings: {},
    } as never);

    // Mock for the domain duplicate check
    vi.mocked(prisma.organization.findFirst).mockResolvedValueOnce(null);

    const formData = new FormData();
    formData.set("name", "New organization name");
    formData.set("domain", "example.com");
    formData.set("logoUrl", "https://example.com/logo.png");
    formData.set("address", "Business Bay, Dubai");

    const result = await updateOrganization(formData);

    expect(result.success).toBe(true);
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: {
        name: "New organization name",
        domain: "example.com",
        logoUrl: "https://example.com/logo.png",
        settings: expect.objectContaining({ address: "Business Bay, Dubai" }),
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/settings/organization");
  });
});
