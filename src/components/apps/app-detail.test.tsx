// src/components/apps/app-detail.test.tsx
import type { AppDetail as AppDetailType } from "@/types/app";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppDetail } from "./app-detail";

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

const mockApp: AppDetailType = {
  id: "app-1",
  name: "Slack",
  status: "ACTIVE",
  source: "MANUAL",
  category: "Collaboration",
  catalogId: null,
  customLogoUrl: "https://example.com/slack.png",
  catalogLogoUrl: null,
  customWebsite: "https://slack.com",
  notes: "Team communication tool",
  tags: ["chat", "team"],
  riskScore: null,
  discoveredAt: null,
  ownerName: "John Smith",
  ownerEmail: "hong@test.com",
  subscriptionCount: 2,
  userAccessCount: 10,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-02"),
  teams: [],
};

describe("AppDetail", () => {
  it("shows the app information", () => {
    render(<AppDetail app={mockApp} />);

    expect(screen.getAllByText("Slack").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("In Use").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Collaboration").length).toBeGreaterThanOrEqual(
      1
    );
  });

  it("shows the edit button", () => {
    render(<AppDetail app={mockApp} />);

    const editButton = screen.getByRole("link", { name: /Edit/ });
    expect(editButton).toHaveAttribute("href", "/apps/app-1/edit");
  });

  it("shows the logo image", () => {
    render(<AppDetail app={mockApp} />);

    const logo = screen.getByAltText("Slack");
    expect(logo).toHaveAttribute("src", "https://example.com/slack.png");
  });

  it("shows the first letter when there is no logo", () => {
    const appWithoutLogo: AppDetailType = {
      ...mockApp,
      customLogoUrl: null,
      catalogLogoUrl: null,
    };

    render(<AppDetail app={appWithoutLogo} />);

    expect(screen.getByText("S")).toBeInTheDocument(); // first letter of Slack
  });

  it("shows the owner information", () => {
    render(<AppDetail app={mockApp} />);

    expect(screen.getByText("John Smith")).toBeInTheDocument();
    expect(screen.getByText("hong@test.com")).toBeInTheDocument();
  });

  it("shows unassigned when there is no owner", () => {
    const appWithoutOwner: AppDetailType = {
      ...mockApp,
      ownerName: null,
      ownerEmail: null,
    };

    render(<AppDetail app={appWithoutOwner} />);

    expect(screen.getByText("No owner assigned")).toBeInTheDocument();
  });

  it("shows the subscription and user counts", () => {
    render(<AppDetail app={mockApp} />);

    expect(screen.getByText("2")).toBeInTheDocument(); // subscriptionCount
    expect(screen.getByText("10")).toBeInTheDocument(); // userAccessCount
  });

  it("shows the notes when present", () => {
    render(<AppDetail app={mockApp} />);

    expect(screen.getByText("Team communication tool")).toBeInTheDocument();
  });

  it("shows the tags", () => {
    render(<AppDetail app={mockApp} />);

    expect(screen.getByText("chat")).toBeInTheDocument();
    expect(screen.getByText("team")).toBeInTheDocument();
  });

  it("shows the website link", () => {
    render(<AppDetail app={mockApp} />);

    const websiteLink = screen.getByRole("link", { name: /slack\.com/i });
    expect(websiteLink).toHaveAttribute("href", "https://slack.com");
  });
});
