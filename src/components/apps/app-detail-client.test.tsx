// src/components/apps/app-detail-client.test.tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppDetailClient } from "./app-detail-client";

const mockUseShow = vi.fn();
const mockUseCan = vi.fn();
const mockRouter = { push: vi.fn(), back: vi.fn() };

vi.mock("@refinedev/core", () => ({
  useShow: (...args: unknown[]) => mockUseShow(...args),
  useCan: (...args: unknown[]) => mockUseCan(...args),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
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

const mockAppData = {
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
};

describe("AppDetailClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseShow.mockReturnValue({
      query: {
        data: { data: mockAppData },
        isLoading: false,
      },
    });
    mockUseCan.mockReturnValue({ data: { can: true } });
  });

  it("renders the app name as the title", () => {
    render(<AppDetailClient id="app-1" />);

    // Both PageHeader and AppDetail may show the app name
    const headings = screen.getAllByRole("heading", { name: "Slack" });
    expect(headings.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("View and manage app details")).toBeInTheDocument();
  });

  it("shows the loading state while loading", () => {
    mockUseShow.mockReturnValueOnce({
      query: { data: undefined, isLoading: true },
    });

    render(<AppDetailClient id="app-1" />);

    expect(screen.getByText(/Loading/)).toBeInTheDocument();
  });

  it("shows an error message when the app is missing", () => {
    mockUseShow.mockReturnValueOnce({
      query: { data: { data: null }, isLoading: false },
    });

    render(<AppDetailClient id="app-1" />);

    expect(screen.getByText(/App not found/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to list/ })).toHaveAttribute(
      "href",
      "/apps"
    );
  });

  it("calls useShow with the correct parameters", () => {
    render(<AppDetailClient id="app-123" />);

    expect(mockUseShow).toHaveBeenCalledWith({
      resource: "apps",
      id: "app-123",
      queryOptions: {
        enabled: true,
      },
    });
  });

  it("edit button link has the correct path", () => {
    render(<AppDetailClient id="app-1" />);

    // Both PageHeader and AppDetail may render an edit link
    const editLinks = screen.getAllByRole("link", { name: /Edit/ });
    expect(editLinks.length).toBeGreaterThanOrEqual(1);
    expect(editLinks[0]).toHaveAttribute("href", "/apps/app-1/edit");
  });
});
