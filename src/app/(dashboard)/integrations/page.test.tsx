import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import IntegrationsPage from "./page";

const mockRedirect = vi.fn();
const mockRequireOrganization = vi.fn();
const mockCan = vi.fn();
const mockRequirePermissionOrRedirect = vi.fn();

vi.mock("@/lib/rbac/service", () => ({
  can: (...args: unknown[]) => mockCan(...args),
  requirePermissionOrRedirect: (...args: unknown[]) =>
    mockRequirePermissionOrRedirect(...args),
}));

vi.mock("@/components/integrations/integrations-page-client", () => ({
  IntegrationsPageClient: ({
    canManage,
    role,
  }: {
    canManage: boolean;
    role: string;
  }) => (
    <div
      data-testid="integrations-client"
      data-can-manage={String(canManage)}
      data-role={role}
    >
      Integrations Client
    </div>
  ),
}));

vi.mock("@/lib/auth/require-auth", () => ({
  requireOrganization: () => mockRequireOrganization(),
}));

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => mockRedirect(...args),
}));

describe("IntegrationsPage (server)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    mockCan.mockResolvedValue(true);
    mockRequirePermissionOrRedirect.mockResolvedValue({});
  });

  it("renders the client with canManage=true for admins", async () => {
    const page = await IntegrationsPage();
    render(page);

    const client = screen.getByTestId("integrations-client");
    expect(client).toHaveAttribute("data-can-manage", "true");
    expect(client).toHaveAttribute("data-role", "ADMIN");
  });

  it("renders with canManage=false for members", async () => {
    mockRequireOrganization.mockResolvedValueOnce({
      session: {
        user: {
          id: "user-2",
          email: "member@example.com",
          name: "Member",
          organizationId: "org-1",
          role: "MEMBER",
        },
      },
      organizationId: "org-1",
      userId: "user-2",
      role: "MEMBER",
    });
    mockCan.mockResolvedValueOnce(false);

    const page = await IntegrationsPage();
    render(page);

    const client = screen.getByTestId("integrations-client");
    expect(client).toHaveAttribute("data-can-manage", "false");
    expect(client).toHaveAttribute("data-role", "MEMBER");
  });

  it("gates the page on integrations:read and actions on integrations:manage", async () => {
    await IntegrationsPage();
    expect(mockRequirePermissionOrRedirect).toHaveBeenCalledWith(
      "integrations:read"
    );
    expect(mockCan).toHaveBeenCalledWith("integrations:manage");
  });

  it("redirects when integrations:read is missing", async () => {
    mockRequirePermissionOrRedirect.mockImplementationOnce(() => {
      throw new Error("NEXT_REDIRECT");
    });
    await expect(IntegrationsPage()).rejects.toThrow("NEXT_REDIRECT");
  });

  it("lets requireOrganization handle the redirect when there is no session", async () => {
    // requireOrganization calls redirect internally, so
    // simulating a missing session requires throwing
    mockRequireOrganization.mockImplementationOnce(() => {
      mockRedirect("/login");
      throw new Error("NEXT_REDIRECT");
    });

    await expect(IntegrationsPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });
});
