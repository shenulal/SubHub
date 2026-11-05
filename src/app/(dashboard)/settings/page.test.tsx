// src/app/(dashboard)/settings/page.test.tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "./page";

const mockUseGetIdentity = vi.fn();
const mockRequireOrganization = vi.fn();

vi.mock("@refinedev/core", () => ({
  useGetIdentity: (...args: unknown[]) => mockUseGetIdentity(...args),
}));

// Mock require-auth
vi.mock("@/lib/auth/require-auth", () => ({
  requireOrganization: () => mockRequireOrganization(),
}));

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGetIdentity.mockReturnValue({
      data: {
        id: "user-1",
        email: "test@example.com",
        name: "Test Admin",
        organizationId: "org-1",
        role: "ADMIN",
      },
      isLoading: false,
    });
    mockRequireOrganization.mockResolvedValue({
      session: {
        user: {
          id: "user-1",
          email: "test@example.com",
          name: "Test Admin",
          organizationId: "org-1",
          role: "ADMIN",
        },
      },
      organizationId: "org-1",
      userId: "user-1",
      role: "ADMIN",
    });
  });

  it("shows the settings overview card", async () => {
    const page = await SettingsPage();
    render(page);

    expect(screen.getByText("Settings overview")).toBeInTheDocument();
    expect(
      screen.getByText("Choose a setting from the left menu")
    ).toBeInTheDocument();
  });

  it("shows the user name", async () => {
    const page = await SettingsPage();
    render(page);

    expect(screen.getByText("Test Admin")).toBeInTheDocument();
  });

  it("shows the user email", async () => {
    const page = await SettingsPage();
    render(page);

    expect(screen.getByText("test@example.com")).toBeInTheDocument();
  });

  it("shows the user role", async () => {
    const page = await SettingsPage();
    render(page);

    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("shows part of the organization ID", async () => {
    const page = await SettingsPage();
    render(page);

    // First 8 characters of org-1 + "..."
    expect(screen.getByText(/org-1.../)).toBeInTheDocument();
  });

  it("lets non-admins see basic settings information", async () => {
    mockRequireOrganization.mockResolvedValueOnce({
      session: {
        user: {
          id: "user-2",
          email: "member@example.com",
          name: "Test Member",
          organizationId: "org-1",
          role: "MEMBER",
        },
      },
      organizationId: "org-1",
      userId: "user-2",
      role: "MEMBER",
    });
    mockUseGetIdentity.mockReturnValueOnce({
      data: {
        id: "user-2",
        email: "member@example.com",
        name: "Test Member",
        organizationId: "org-1",
        role: "MEMBER",
      },
      isLoading: false,
    });

    const page = await SettingsPage();
    render(page);

    // Members must also be able to see basic settings information
    expect(screen.getByText("Test Member")).toBeInTheDocument();
    expect(screen.getByText("member@example.com")).toBeInTheDocument();
    expect(screen.getByText("Member")).toBeInTheDocument();
  });
});
