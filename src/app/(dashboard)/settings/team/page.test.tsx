// src/app/(dashboard)/settings/team/page.test.tsx
import { getInvitations } from "@/actions/invitations";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TeamPage from "./page";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/actions/invitations", () => ({
  createInvitation: vi.fn(),
  getInvitations: vi.fn(),
  cancelInvitation: vi.fn(),
  resendInvitation: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT: ${url}`);
  }),
}));

describe("TeamPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a notice for non-admins", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", organizationId: "org-1", role: "MEMBER" },
    } as never);

    const page = await TeamPage();
    render(page);

    expect(
      screen.getByText(/Only administrators can manage team members/)
    ).toBeInTheDocument();
  });

  it("shows the invite form and list for admins", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", organizationId: "org-1", role: "ADMIN" },
    } as never);

    vi.mocked(getInvitations).mockResolvedValue({
      success: true,
      data: [
        {
          id: "inv-1",
          email: "test@example.com",
          role: "MEMBER",
          status: "PENDING",
          token: "t",
          organizationId: "org-1",
          invitedById: "user-1",
          expiresAt: new Date("2024-01-01"),
          createdAt: new Date(),
          updatedAt: new Date(),
          invitedBy: { name: "Admin" },
        },
      ],
    } as never);

    const page = await TeamPage();
    render(page);

    // "Invite Member" appears in both the PageHeader and the Card title, so use getAllByText
    expect(screen.getAllByText("Invite Member").length).toBeGreaterThanOrEqual(
      1
    );
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByText(/test@example.com/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Resend/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Cancel invite/i })
    ).toBeInTheDocument();
  });
});
