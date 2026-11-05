// src/app/(dashboard)/settings/profile/page.test.tsx
import { prisma } from "@/lib/db";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "./page";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: {
      id: "user-1",
      email: "test@example.com",
      name: "Test User",
      organizationId: "org-1",
      role: "MEMBER",
    },
  }),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the profile form fields", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      name: "Test User",
      department: "Platform",
      // jobTitle and avatarUrl are commented out and unused
    } as never);

    const page = await ProfilePage();
    render(page);

    expect(screen.getByText("Name *")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Test User")).toBeInTheDocument();
  });

  it("does not show the avatar (commented out)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      name: "Test User",
      department: "Platform",
    } as never);

    const page = await ProfilePage();
    render(page);

    expect(screen.queryByText("Avatar")).not.toBeInTheDocument();
    expect(screen.queryByText("Regenerate")).not.toBeInTheDocument();
  });

  it("does not show the job title field (commented out)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      name: "Test User",
      department: "Platform",
    } as never);

    const page = await ProfilePage();
    render(page);

    expect(screen.queryByText("Title")).not.toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(/Product Engineer/)
    ).not.toBeInTheDocument();
  });

  it("shows the department as text", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      name: "Test User",
      department: "Platform",
    } as never);

    const page = await ProfilePage();
    render(page);

    expect(screen.getByText("Department")).toBeInTheDocument();
    expect(screen.getByText("Platform")).toBeInTheDocument();
    // Check that the department is shown as text, not as an input field
    expect(
      screen.queryByPlaceholderText(/Platform Team/)
    ).not.toBeInTheDocument();
  });

  it("shows the email as text", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      name: "Test User",
      department: "Platform",
    } as never);

    const page = await ProfilePage();
    render(page);

    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
  });
});
