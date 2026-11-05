// src/components/users/user-list.test.tsx
import type { UserListItem } from "@/types/user";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UserList } from "./user-list";

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

const mockUsers: UserListItem[] = [
  {
    id: "user-1",
    email: "admin@example.com",
    name: "Admin",
    avatarUrl: "https://example.com/avatar1.png",
    role: "ADMIN",
    status: "ACTIVE",
    department: "Management",
    team: { id: "team-1", name: "Management" },
    jobTitle: "CTO",
    lastLoginAt: new Date("2024-01-15"),
    terminatedAt: null,
    assignedAppCount: 10,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-15"),
  },
  {
    id: "user-2",
    email: "member@example.com",
    name: "Teammate",
    avatarUrl: null,
    role: "MEMBER",
    status: "ACTIVE",
    department: "Engineering",
    team: { id: "team-2", name: "Engineering" },
    jobTitle: "Developer",
    lastLoginAt: new Date("2024-01-10"),
    terminatedAt: null,
    assignedAppCount: 5,
    createdAt: new Date("2024-01-02"),
    updatedAt: new Date("2024-01-10"),
  },
  {
    id: "user-3",
    email: "terminated@example.com",
    name: "Former Employee",
    avatarUrl: null,
    role: "MEMBER",
    status: "TERMINATED",
    department: "Engineering",
    team: null,
    jobTitle: "Developer",
    lastLoginAt: new Date("2023-12-01"),
    terminatedAt: new Date("2024-01-05"),
    assignedAppCount: 3,
    createdAt: new Date("2023-01-01"),
    updatedAt: new Date("2024-01-05"),
  },
];

describe("UserList", () => {
  it("shows an empty-state message when the user list is empty", () => {
    render(<UserList users={[]} />);

    expect(screen.getByText("No users found")).toBeInTheDocument();
  });

  it("shows the table when users exist", () => {
    render(<UserList users={mockUsers} />);

    // "Admin" appears in both the name and the role badge
    const adminElements = screen.getAllByText("Admin");
    expect(adminElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Teammate")).toBeInTheDocument();
    expect(screen.getByText("Former Employee")).toBeInTheDocument();
  });

  it("renders the email as a link to the user detail page", () => {
    render(<UserList users={mockUsers} />);

    const adminLink = screen.getByText("admin@example.com").closest("a");
    expect(adminLink).toHaveAttribute("href", "/users/user-1");
  });

  it("shows the correct badge for each user status", () => {
    render(<UserList users={mockUsers} />);

    // 2 active users
    const activeElements = screen.getAllByText("Active");
    expect(activeElements.length).toBe(2);

    // 1 terminated user
    expect(screen.getByText("Terminated")).toBeInTheDocument();
  });

  it("shows user roles correctly", () => {
    render(<UserList users={mockUsers} />);

    // "Admin" appears in both the name and the role badge
    const adminElements = screen.getAllByText("Admin");
    expect(adminElements.length).toBeGreaterThanOrEqual(1);
    // "Member" is shown in the role badge
    const memberBadges = screen.getAllByText("Member");
    expect(memberBadges.length).toBe(2);
  });

  it("shows department information", () => {
    render(<UserList users={mockUsers} />);

    expect(screen.getByText("Management")).toBeInTheDocument();
    // "Engineering" has 2 users
    const devDept = screen.getAllByText("Engineering");
    expect(devDept.length).toBe(2);
  });

  it("shows the app access count", () => {
    render(<UserList users={mockUsers} />);

    // The same number may appear in several places
    expect(screen.getAllByText("10").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("5").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("3").length).toBeGreaterThanOrEqual(1);
  });

  it("shows the formatted last login date", () => {
    render(<UserList users={mockUsers} />);

    expect(screen.getByText("2024.01.15")).toBeInTheDocument();
    expect(screen.getByText("2024.01.10")).toBeInTheDocument();
  });

  it("shows the image when an avatar URL exists", () => {
    render(<UserList users={mockUsers} />);

    const avatarImg = screen.getByAltText("Admin");
    expect(avatarImg).toHaveAttribute("src", "https://example.com/avatar1.png");
  });

  it("shows the first letter of the name when there is no avatar URL", () => {
    render(<UserList users={mockUsers} />);

    // "T" (first letter of Teammate)
    expect(screen.getByText("T")).toBeInTheDocument();
  });

  it("navigates to the user detail page when the name is clicked", () => {
    render(<UserList users={mockUsers} />);

    // "Admin" appears in several places, so use the first element
    const adminElements = screen.getAllByText("Admin");
    const nameLink = adminElements[0].closest("a");
    expect(nameLink).toHaveAttribute("href", "/users/user-1");
  });
});
