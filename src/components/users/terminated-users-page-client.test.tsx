// src/components/users/terminated-users-page-client.test.tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TerminatedUsersPageClient } from "./terminated-users-page-client";

const mockUseList = vi.fn();

vi.mock("@refinedev/core", () => ({
  useList: (...args: unknown[]) => mockUseList(...args),
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

// Mock next/image
vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} />
  ),
}));

// Mock next/navigation (blocks the internal next-auth dependency)
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

// Mock next-auth
vi.mock("next-auth", () => ({
  __esModule: true,
  default: () => ({}),
  auth: vi.fn(),
}));

const mockTerminatedUsers = [
  {
    id: "user-1",
    email: "terminated@example.com",
    name: "Terminated User",
    avatarUrl: null,
    role: "MEMBER",
    status: "TERMINATED",
    department: "Engineering",
    terminatedAt: new Date("2024-01-05"),
    appAccesses: [
      {
        id: "access-1",
        appId: "app-1",
        appName: "Slack",
        appLogoUrl: null,
        lastAccessedAt: new Date("2024-01-04"),
      },
    ],
  },
];

describe("TerminatedUsersPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseList.mockReturnValue({
      query: {
        data: { data: mockTerminatedUsers, total: 1 },
        isLoading: false,
      },
    });
  });

  it("renders the terminated users list", () => {
    render(<TerminatedUsersPageClient />);

    expect(screen.getByText("Terminated User")).toBeInTheDocument();
    expect(screen.getByText("terminated@example.com")).toBeInTheDocument();
  });

  it("shows the loading state while loading", () => {
    mockUseList.mockReturnValueOnce({
      query: { data: undefined, isLoading: true },
    });

    render(<TerminatedUsersPageClient />);

    expect(screen.getByText(/Loading terminated users/)).toBeInTheDocument();
  });

  it("passes an empty array when there is no data", () => {
    mockUseList.mockReturnValueOnce({
      query: { data: { data: [], total: 0 }, isLoading: false },
    });

    render(<TerminatedUsersPageClient />);

    // TerminatedUsersList handles the empty list
    expect(screen.getByText("No terminated users")).toBeInTheDocument();
  });

  it("calls useList with the correct parameters", () => {
    render(<TerminatedUsersPageClient />);

    expect(mockUseList).toHaveBeenCalledWith({
      resource: "terminated-users",
      pagination: { pageSize: 20 },
    });
  });
});
