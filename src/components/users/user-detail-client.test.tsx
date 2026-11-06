// src/components/users/user-detail-client.test.tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserDetailClient } from "./user-detail-client";

const mockUseShow = vi.fn();
const mockUseCan = vi.fn();
const mockUseGetIdentity = vi.fn();
const mockRouter = { push: vi.fn(), back: vi.fn(), refresh: vi.fn() };

vi.mock("@refinedev/core", () => ({
  useShow: (...args: unknown[]) => mockUseShow(...args),
  useCan: (...args: unknown[]) => mockUseCan(...args),
  useGetIdentity: (...args: unknown[]) => mockUseGetIdentity(...args),
}));

// Mock next-intl: key passthrough with ICU param substitution
vi.mock("next-intl", () => ({
  useTranslations: () => {
    const t = (key: string, params?: Record<string, unknown>) => {
      if (params) {
        let result = key;
        for (const [k, v] of Object.entries(params)) {
          result = result.replace(`{${k}}`, String(v));
        }
        return result;
      }
      return key;
    };
    return t;
  },
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

// Mock next-auth (blocks the server-module dependency)
vi.mock("next-auth", () => ({
  __esModule: true,
  default: () => ({}),
  auth: vi.fn(),
}));

// Mock dialogs to cut off server-action import chains
vi.mock("./member-credentials-dialog", () => ({
  MemberCredentialsButton: () => null,
}));

vi.mock("./offboard-user-dialog", () => ({
  OffboardUserDialog: () => null,
}));

vi.mock("@/components/team/transfer-admin-dialog", () => ({
  TransferAdminDialog: () => null,
}));

const mockUserData = {
  id: "user-1",
  name: "John Smith",
  email: "hong@test.com",
  role: "MEMBER",
  status: "ACTIVE",
  department: "Engineering",
  team: null,
  assignedAppCount: 5,
  lastLoginAt: new Date("2024-01-15"),
  createdAt: new Date("2024-01-01"),
  appAccesses: [],
};

describe("UserDetailClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseShow.mockReturnValue({
      query: {
        data: { data: mockUserData },
        isLoading: false,
      },
    });
    mockUseCan.mockReturnValue({ data: { can: false } });
    mockUseGetIdentity.mockReturnValue({ data: null });
  });

  it("renders user details", () => {
    render(<UserDetailClient id="user-1" />);

    // PageHeader shows the user name as the title
    expect(
      screen.getByRole("heading", { name: "John Smith" })
    ).toBeInTheDocument();
    // Role/status labels inside the combined card (i18n key passthrough)
    expect(screen.getByText("users.role.member")).toBeInTheDocument();
    expect(screen.getByText("users.status.active")).toBeInTheDocument();
    // View subscriptions button
    expect(
      screen.getByRole("button", { name: /users\.detail\.viewSubscriptions/ })
    ).toBeInTheDocument();
  });

  it("shows the loading state while loading", () => {
    mockUseShow.mockReturnValueOnce({
      query: { data: undefined, isLoading: true },
    });

    render(<UserDetailClient id="user-1" />);

    expect(screen.getByText("users.detail.loading")).toBeInTheDocument();
  });

  it("shows an error message when the user does not exist", () => {
    mockUseShow.mockReturnValueOnce({
      query: { data: { data: null }, isLoading: false },
    });

    render(<UserDetailClient id="user-1" />);

    expect(screen.getByText("users.detail.notFound")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /users\.detail\.backToList/ })
    ).toHaveAttribute("href", "/users");
  });

  it("shows department information", () => {
    render(<UserDetailClient id="user-1" />);

    // department is shown as an InfoItem value
    expect(screen.getByText("Engineering")).toBeInTheDocument();
  });

  it("shows the team name instead of the department when present", () => {
    mockUseShow.mockReturnValueOnce({
      query: {
        data: {
          data: {
            ...mockUserData,
            team: { id: "team-1", name: "Frontend Team" },
          },
        },
        isLoading: false,
      },
    });

    render(<UserDetailClient id="user-1" />);

    expect(screen.getByText("Frontend Team")).toBeInTheDocument();
  });

  it("shows - when there is no department", () => {
    mockUseShow.mockReturnValueOnce({
      query: {
        data: {
          data: { ...mockUserData, department: null, team: null },
        },
        isLoading: false,
      },
    });

    render(<UserDetailClient id="user-1" />);

    // "-" may appear in several places
    expect(screen.getAllByText("-").length).toBeGreaterThanOrEqual(1);
  });

  it("shows the app access count", () => {
    render(<UserDetailClient id="user-1" />);

    expect(screen.getByText("users.detail.appAccessCount")).toBeInTheDocument();
    expect(screen.getAllByText("5").length).toBeGreaterThanOrEqual(1);
  });

  it("calls useShow with the correct parameters", () => {
    render(<UserDetailClient id="user-123" />);

    expect(mockUseShow).toHaveBeenCalledWith({
      resource: "users",
      id: "user-123",
      queryOptions: {
        enabled: true,
      },
    });
  });

  it("shows the email as the title when there is no name", () => {
    mockUseShow.mockReturnValueOnce({
      query: {
        data: { data: { ...mockUserData, name: null } },
        isLoading: false,
      },
    });

    render(<UserDetailClient id="user-1" />);

    // The email is shown in the PageHeader title
    expect(
      screen.getByRole("heading", { name: "hong@test.com" })
    ).toBeInTheDocument();
  });

  it("does not show the connected apps section", () => {
    render(<UserDetailClient id="user-1" />);

    // The connectedApps key must not be present
    expect(
      screen.queryByText("users.detail.connectedApps")
    ).not.toBeInTheDocument();
  });

  it("shows role/status only inside the card", () => {
    render(<UserDetailClient id="user-1" />);

    // Role/status labels must be inside the card
    expect(screen.getByText("users.detail.role")).toBeInTheDocument();
    expect(screen.getByText("users.detail.status")).toBeInTheDocument();
  });

  describe("subscription KPI grid", () => {
    const mockSubscriptionSummary = {
      total: 8,
      monthlyAmount: 250000,
      renewingSoon: 2,
      currency: "KRW",
    };

    it("shows KPI values when a subscription summary exists", () => {
      mockUseShow.mockReturnValueOnce({
        query: {
          data: {
            data: {
              ...mockUserData,
              subscriptionSummary: mockSubscriptionSummary,
            },
          },
          isLoading: false,
        },
      });

      render(<UserDetailClient id="user-1" />);

      // Check KPI numeric values
      expect(screen.getByText("8")).toBeInTheDocument();
      expect(screen.getByText(/250,000/)).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();

      // Check KPI labels
      expect(
        screen.getByText("users.detail.totalSubscriptions")
      ).toBeInTheDocument();
      expect(screen.getByText("users.detail.monthlyCost")).toBeInTheDocument();
      expect(screen.getByText("users.detail.renewingSoon")).toBeInTheDocument();
    });

    it("shows the empty message when there is no subscription summary", () => {
      render(<UserDetailClient id="user-1" />);

      expect(
        screen.getByText("users.detail.noSubscriptions")
      ).toBeInTheDocument();
    });

    it("shows the $ symbol for USD currency", () => {
      mockUseShow.mockReturnValueOnce({
        query: {
          data: {
            data: {
              ...mockUserData,
              subscriptionSummary: {
                ...mockSubscriptionSummary,
                currency: "USD",
                monthlyAmount: 199,
              },
            },
          },
          isLoading: false,
        },
      });

      render(<UserDetailClient id="user-1" />);

      expect(screen.getByText(/\$199/)).toBeInTheDocument();
    });
  });
});
