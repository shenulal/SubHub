// src/components/apps/app-list.test.tsx
import type { AppListItem } from "@/types/app";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppList } from "./app-list";

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

const mutateAsyncMock = vi.fn();

// Mock refine delete hook
vi.mock("@refinedev/core", () => ({
  useDelete: () => ({
    mutateAsync: mutateAsyncMock,
    isLoading: false,
  }),
}));

const mockApps: AppListItem[] = [
  {
    id: "app-1",
    name: "Slack",
    status: "ACTIVE",
    source: "MANUAL",
    category: "Collaboration",
    customLogoUrl: null,
    catalogLogoUrl: "https://example.com/slack.png",
    ownerName: "John Smith",
    ownerEmail: "hong@test.com",
    subscriptionCount: 2,
    userAccessCount: 10,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-02"),
    teams: [],
  },
  {
    id: "app-2",
    name: "Notion",
    status: "INACTIVE",
    source: "SSO_DISCOVERY",
    category: "Productivity",
    customLogoUrl: "https://custom.com/notion.png",
    catalogLogoUrl: null,
    ownerName: null,
    ownerEmail: null,
    subscriptionCount: 1,
    userAccessCount: 5,
    createdAt: new Date("2024-01-03"),
    updatedAt: new Date("2024-01-04"),
    teams: [],
  },
  {
    id: "app-3",
    name: "Legacy App",
    status: "BLOCKED",
    source: "MANUAL",
    category: null,
    customLogoUrl: null,
    catalogLogoUrl: null,
    ownerName: null,
    ownerEmail: null,
    subscriptionCount: 0,
    userAccessCount: 0,
    createdAt: new Date("2024-01-05"),
    updatedAt: new Date("2024-01-06"),
    teams: [],
  },
];

describe("AppList", () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset();
  });

  it("shows a guidance message when the app list is empty", () => {
    render(<AppList apps={[]} />);

    expect(screen.getByText("No apps registered")).toBeInTheDocument();
    expect(screen.getByText("Register first app")).toBeInTheDocument();
  });

  it("shows the table when apps exist", () => {
    render(<AppList apps={mockApps} />);

    expect(screen.getByText("Slack")).toBeInTheDocument();
    expect(screen.getByText("Notion")).toBeInTheDocument();
    expect(screen.getByText("Legacy App")).toBeInTheDocument();
  });

  it("links the app name to the detail page", () => {
    render(<AppList apps={mockApps} />);

    const slackLink = screen.getByText("Slack").closest("a");
    expect(slackLink).toHaveAttribute("href", "/apps/app-1");
  });

  it("shows the correct badge for each app status", () => {
    render(<AppList apps={mockApps} />);

    expect(screen.getByText("In Use")).toBeInTheDocument();
    expect(screen.getByText("Disabled")).toBeInTheDocument();
    expect(screen.getByText("Blocked")).toBeInTheDocument();
  });

  it("shows - when there is no category", () => {
    render(<AppList apps={mockApps} />);

    const rows = screen.getAllByRole("row");
    // Verify "-" is shown in the Legacy App row
    expect(rows[3]).toHaveTextContent("-");
  });

  it("shows the subscription and user counts", () => {
    render(<AppList apps={mockApps} />);

    const rows = screen.getAllByRole("row");
    // Slack row (index 1)
    expect(rows[1]).toHaveTextContent("2"); // subscriptionCount
    expect(rows[1]).toHaveTextContent("10"); // userAccessCount
  });

  it("shows the formatted created date", () => {
    render(<AppList apps={mockApps} />);

    expect(screen.getByText("2024.01.01")).toBeInTheDocument();
    expect(screen.getByText("2024.01.03")).toBeInTheDocument();
  });

  it("shows an image when a logo URL exists", () => {
    render(<AppList apps={mockApps} />);

    const slackImg = screen.getByAltText("Slack");
    expect(slackImg).toHaveAttribute("src", "https://example.com/slack.png");
  });

  it("shows the first letter when there is no logo URL", () => {
    render(<AppList apps={mockApps} />);

    expect(screen.getByText("L")).toBeInTheDocument(); // Legacy App
  });

  it("shows '-' instead of actions without manage permission", () => {
    render(<AppList apps={mockApps} canManage={false} />);

    // '-' is shown in the same column as the last table header
    expect(screen.getAllByText("-")[0]).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Edit/ })
    ).not.toBeInTheDocument();
  });

  it("calls refine deleteOne when deletion is confirmed", async () => {
    const user = userEvent.setup();
    mutateAsyncMock.mockResolvedValue({ data: { id: "app-1" } });

    render(<AppList apps={mockApps} />);

    // Click the first row's menu button
    const menuButtons = screen.getAllByRole("button", { name: "" });
    await user.click(menuButtons[0]);

    // Click the delete item
    const deleteMenuItem = screen.getByText("Delete");
    await user.click(deleteMenuItem);

    // Click the confirm button
    const confirmButton = screen.getByRole("button", { name: "Delete" });
    await user.click(confirmButton);

    expect(mutateAsyncMock).toHaveBeenCalledWith({
      resource: "apps",
      id: "app-1",
      mutationMode: "pessimistic",
    });
  });
});
