// src/components/subscriptions/subscription-detail-client.test.tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SubscriptionDetailClient } from "./subscription-detail-client";

const mockUseShow = vi.fn();

vi.mock("@refinedev/core", () => ({
  useShow: (...args: unknown[]) => mockUseShow(...args),
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

// Mock deleteSubscription action
vi.mock("@/actions/subscriptions", () => ({
  deleteSubscription: vi.fn(),
  getLinkedPayments: vi.fn().mockResolvedValue({ success: true, data: [] }),
}));

vi.mock("@/components/subscriptions/subscription-status-actions", () => ({
  SubscriptionStatusActions: () => <div data-testid="status-actions" />,
}));

vi.mock("@/components/subscriptions/subscription-detail", () => ({
  SubscriptionDetail: ({
    subscription,
  }: {
    subscription: { appName: string };
  }) => <div>{subscription.appName}</div>,
}));

// Mock notification-settings action
vi.mock("@/actions/notification-settings", () => ({
  updateNotificationSettings: vi.fn().mockResolvedValue({ success: true }),
}));

const mockSubscriptionData = {
  id: "sub-1",
  appId: "app-1",
  appName: "Slack",
  appLogoUrl: "https://example.com/slack.png",
  status: "ACTIVE",
  billingCycle: "MONTHLY",
  amount: 10000,
  currency: "KRW",
  totalLicenses: 100,
  usedLicenses: 80,
  startDate: new Date("2024-01-01"),
  endDate: null,
  renewalDate: new Date("2024-02-01"),
  autoRenewal: true,
  renewalAlert30: true,
  renewalAlert60: false,
  renewalAlert90: false,
  contractUrl: "https://example.com/contract.pdf",
  notes: "This is a test note",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-15"),
};

describe("SubscriptionDetailClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseShow.mockReturnValue({
      query: {
        data: { data: mockSubscriptionData },
        isLoading: false,
      },
    });
  });

  it("renders the subscription details", async () => {
    render(<SubscriptionDetailClient id="sub-1" />);

    // Title: "{appName} subscription"
    expect(await screen.findByText("Slack subscription")).toBeInTheDocument();
    expect(screen.getAllByText("Slack").length).toBeGreaterThanOrEqual(1);
  });

  it("shows the loading state while loading", () => {
    mockUseShow.mockReturnValueOnce({
      query: { data: undefined, isLoading: true },
    });

    render(<SubscriptionDetailClient id="sub-1" />);

    expect(
      screen.getByText(/Loading subscription details/)
    ).toBeInTheDocument();
  });

  it("shows an error message when the subscription is missing", () => {
    mockUseShow.mockReturnValueOnce({
      query: { data: { data: null }, isLoading: false },
    });

    render(<SubscriptionDetailClient id="sub-1" />);

    expect(screen.getByText(/Subscription not found/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to list/ })).toHaveAttribute(
      "href",
      "/subscriptions"
    );
  });

  it("calls useShow with the correct parameters", () => {
    render(<SubscriptionDetailClient id="sub-123" />);

    expect(mockUseShow).toHaveBeenCalledWith({
      resource: "subscriptions",
      id: "sub-123",
      queryOptions: {
        enabled: true,
      },
    });
  });
});
