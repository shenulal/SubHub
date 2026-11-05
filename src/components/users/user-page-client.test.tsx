// src/components/users/user-page-client.test.tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserPageClient } from "./user-page-client";

const mockUseList = vi.fn();
const mockUseCan = vi.fn();

vi.mock("@refinedev/core", () => ({
  useList: (...args: unknown[]) => mockUseList(...args),
  useCan: (...args: unknown[]) => mockUseCan(...args),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock next/image
vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} />
  ),
}));

const mockUsers = [
  {
    id: "user-1",
    email: "admin@example.com",
    name: "Admin",
    avatarUrl: null,
    role: "ADMIN",
    status: "ACTIVE",
    department: "Management",
    jobTitle: "CTO",
    lastLoginAt: new Date("2024-01-15"),
    terminatedAt: null,
    assignedAppCount: 10,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-15"),
  },
];

describe("UserPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseList.mockReturnValue({
      query: {
        data: { data: mockUsers, total: 1 },
        isLoading: false,
      },
    });
    mockUseCan.mockReturnValue({ data: { can: true } });
  });

  it("renders the user management page", () => {
    render(<UserPageClient />);

    expect(screen.getByText("Users")).toBeInTheDocument();
    expect(
      screen.getByText(/Manage all users in your organization/)
    ).toBeInTheDocument();
  });

  it("shows the KPI stat cards", () => {
    render(<UserPageClient />);

    expect(screen.getByText("Total Users")).toBeInTheDocument();
    expect(screen.getByText("Active Users")).toBeInTheDocument();
    expect(screen.getByText("Inactive Users")).toBeInTheDocument();
    expect(screen.getByText("Terminated Users")).toBeInTheDocument();
  });

  it("shows the user list", () => {
    render(<UserPageClient />);

    // "Admin" appears in both the name and the role badge
    expect(screen.getAllByText("Admin").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("admin@example.com")).toBeInTheDocument();
  });

  it("shows the loading state while loading", () => {
    mockUseList.mockReturnValueOnce({
      query: {
        data: undefined,
        isLoading: true,
      },
    });

    render(<UserPageClient />);

    expect(screen.getByText(/Loading/)).toBeInTheDocument();
  });

  it("shows the empty state when there is no data", () => {
    mockUseList.mockReturnValueOnce({
      query: {
        data: { data: [], total: 0 },
        isLoading: false,
      },
    });

    render(<UserPageClient />);

    expect(screen.getByText("No users found")).toBeInTheDocument();
  });

  it("calls useList with the correct parameters", () => {
    render(<UserPageClient />);

    expect(mockUseList).toHaveBeenCalledWith({
      resource: "users",
      pagination: { pageSize: 50 },
      sorters: [{ field: "name", order: "asc" }],
    });
  });
});
