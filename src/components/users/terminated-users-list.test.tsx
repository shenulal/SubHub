// src/components/users/terminated-users-list.test.tsx
import type { TerminatedUserWithAccess } from "@/types/user";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TerminatedUsersList } from "./terminated-users-list";

// Mock next-auth (blocks the server-module dependency)
vi.mock("next-auth", () => ({
  __esModule: true,
  default: () => ({}),
  auth: vi.fn(),
}));

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => {
    const t = (key: string, params?: Record<string, unknown>) => {
      // billingType keys return the real translated value
      const translations: Record<string, string> = {
        "users.terminated.billingType.PER_SEAT": "Per Seat",
        "users.terminated.billingType.FLAT_RATE": "Flat Rate",
      };
      if (translations[key]) return translations[key];
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

// Mock next/image
vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} />
  ),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
}));

// Mock actions
vi.mock("@/actions/users", () => ({
  revokeUserAppAccess: vi.fn(),
  revokeAllUserAppAccess: vi.fn(),
}));

// Mock users-write actions
vi.mock("@/actions/users-write", () => ({
  permanentlyDeleteUser: vi.fn(),
}));

const mockTerminatedUsers: TerminatedUserWithAccess[] = [
  {
    id: "user-1",
    email: "terminated1@example.com",
    name: "Terminated User 1",
    avatarUrl: "https://example.com/avatar1.png",
    department: "Engineering",
    jobTitle: "Developer",
    terminatedAt: new Date("2024-01-15"),
    unrevokedAccessCount: 5,
    appAccesses: [
      {
        id: "access-1",
        appId: "app-1",
        appName: "Slack",
        appLogoUrl: "https://example.com/slack.png",
        accessLevel: "admin",
        grantedAt: new Date("2023-06-01"),
        lastUsedAt: new Date("2024-01-10"),
        source: "SSO_LOG",
      },
      {
        id: "access-2",
        appId: "app-2",
        appName: "Notion",
        appLogoUrl: null,
        accessLevel: "user",
        grantedAt: new Date("2023-07-01"),
        lastUsedAt: new Date("2024-01-05"),
        source: "SSO_LOG",
      },
      {
        id: "access-3",
        appId: "app-3",
        appName: "Jira",
        appLogoUrl: null,
        accessLevel: "user",
        grantedAt: new Date("2023-08-01"),
        lastUsedAt: null,
        source: "MANUAL",
      },
    ],
    subscriptionAssignments: [
      {
        id: "sa-1",
        subscriptionId: "sub-1",
        appId: "app-4",
        appName: "Figma",
        appLogoUrl: null,
        billingCycle: "MONTHLY",
        billingType: "PER_SEAT",
        assignedAt: new Date("2023-09-15"),
      },
      {
        id: "sa-2",
        subscriptionId: "sub-2",
        appId: "app-5",
        appName: "Adobe CC",
        appLogoUrl: null,
        billingCycle: "YEARLY",
        billingType: "FLAT_RATE",
        assignedAt: new Date("2023-10-01"),
      },
    ],
  },
  {
    id: "user-2",
    email: "terminated2@example.com",
    name: "Terminated User 2",
    avatarUrl: null,
    department: "Marketing",
    jobTitle: "Marketer",
    terminatedAt: new Date("2024-01-10"),
    unrevokedAccessCount: 1,
    appAccesses: [
      {
        id: "access-4",
        appId: "app-1",
        appName: "Slack",
        appLogoUrl: "https://example.com/slack.png",
        accessLevel: "user",
        grantedAt: new Date("2023-09-01"),
        lastUsedAt: new Date("2024-01-08"),
        source: "SSO_LOG",
      },
    ],
    subscriptionAssignments: [],
  },
];

describe("TerminatedUsersList", () => {
  it("shows an empty-state message when there are no terminated users", () => {
    render(<TerminatedUsersList users={[]} />);

    expect(screen.getByText("No terminated users")).toBeInTheDocument();
  });

  it("shows terminated user details", () => {
    render(<TerminatedUsersList users={mockTerminatedUsers} />);

    expect(screen.getByText("Terminated User 1")).toBeInTheDocument();
    expect(screen.getByText("Terminated User 2")).toBeInTheDocument();
    expect(screen.getByText("terminated1@example.com")).toBeInTheDocument();
  });

  it("shows department information", () => {
    render(<TerminatedUsersList users={mockTerminatedUsers} />);

    // Check that the department is included in the text
    expect(screen.getByText(/Engineering/)).toBeInTheDocument();
    expect(screen.getByText(/Marketing/)).toBeInTheDocument();
  });

  it("shows the formatted termination date", () => {
    render(<TerminatedUsersList users={mockTerminatedUsers} />);

    // Check that the termination date is included in the text
    expect(screen.getByText(/2024\.01\.15/)).toBeInTheDocument();
    // 2024.01.10 appears as both a termination date and a last-used date
    const dateElements = screen.getAllByText(/2024\.01\.10/);
    expect(dateElements.length).toBeGreaterThanOrEqual(1);
  });

  it("shows the number of unrevoked apps", () => {
    render(<TerminatedUsersList users={mockTerminatedUsers} />);

    expect(screen.getByText("5 apps")).toBeInTheDocument();
    expect(screen.getByText("1 app")).toBeInTheDocument();
  });

  it("shows app access information", () => {
    render(<TerminatedUsersList users={mockTerminatedUsers} />);

    // Both users have Slack access, so use getAllByText
    const slackElements = screen.getAllByText("Slack");
    expect(slackElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Notion")).toBeInTheDocument();
    expect(screen.getByText("Jira")).toBeInTheDocument();
  });

  it("shows the access level", () => {
    render(<TerminatedUsersList users={mockTerminatedUsers} />);

    expect(screen.getByText("admin")).toBeInTheDocument();
    // "user" appears several times
    const userLevels = screen.getAllByText("user");
    expect(userLevels.length).toBeGreaterThanOrEqual(1);
  });

  it("renders an individual revoke button", () => {
    render(<TerminatedUsersList users={mockTerminatedUsers} />);

    // 4 app accesses in total (3 + 1)
    const revokeButtons = screen.getAllByRole("button", { name: /revoke/i });
    expect(revokeButtons.length).toBeGreaterThanOrEqual(4);
  });

  it("renders a revoke-all button", () => {
    render(<TerminatedUsersList users={mockTerminatedUsers} />);

    const allRevokeButtons = screen.getAllByRole("button", {
      name: /revoke all/i,
    });
    expect(allRevokeButtons.length).toBe(2); // 2 terminated users
  });

  it("shows the avatar image when present", () => {
    render(<TerminatedUsersList users={mockTerminatedUsers} />);

    const avatarImg = screen.getByAltText("Terminated User 1");
    expect(avatarImg).toHaveAttribute("src", "https://example.com/avatar1.png");
  });

  it("shows the billingType badge for subscription assignments", () => {
    render(<TerminatedUsersList users={mockTerminatedUsers} />);

    expect(screen.getByText("Per Seat")).toBeInTheDocument();
    expect(screen.getByText("Flat Rate")).toBeInTheDocument();
  });

  it("shows the first letter of the name when there is no avatar", () => {
    render(<TerminatedUsersList users={mockTerminatedUsers} />);

    // "T" (first letter of Terminated User 2)
    const avatarPlaceholder = screen.getAllByText("T");
    expect(avatarPlaceholder.length).toBeGreaterThanOrEqual(1);
  });
});
