// src/app/(dashboard)/settings/organization/page.test.tsx
import { prisma } from "@/lib/db";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OrganizationSettingsPage from "./page";

// RBAC: the page guard passes (permission gating is covered in src/lib/rbac)
vi.mock("@/lib/rbac/service", async () => {
  const { PERMISSION_KEYS } = await import("@/lib/rbac/permissions");
  const all = new Set<string>(PERMISSION_KEYS);
  return {
    can: vi.fn(async () => true),
    requirePermissionOrRedirect: vi.fn(async () => ({
      userId: "user-1",
      organizationId: "org-1",
      role: "ADMIN",
      permissions: all,
    })),
    getUserPermissionSet: vi.fn(async () => all),
  };
});
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: {
      id: "user-1",
      email: "admin@example.com",
      organizationId: "org-1",
      role: "ADMIN",
    },
  }),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    organization: {
      findUnique: vi.fn(),
    },
  },
}));

describe("OrganizationSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the organization info tab and organization name", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({
      name: "Test Organization",
      domain: "example.com",
      logoUrl: "https://example.com/logo.png",
      settings: { address: "Business Bay, Dubai" },
    } as never);

    const page = await OrganizationSettingsPage();
    render(page);

    expect(screen.getByText("Organization info")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Test Organization")).toBeInTheDocument();
    expect(screen.getByDisplayValue("example.com")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("https://example.com/logo.png")
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Business Bay, Dubai")).toBeInTheDocument();
  });
});
