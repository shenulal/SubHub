// src/components/subscriptions/subscription-detail.test.tsx
import type { SubscriptionDetail as SubscriptionDetailType } from "@/types/subscription";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SubscriptionDetail } from "./subscription-detail";

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

// Mock server actions pulled in by the seat card to avoid next-auth in jsdom
vi.mock("@/actions/users-read", () => ({
  getUsers: vi.fn().mockResolvedValue({ items: [], total: 0 }),
}));
vi.mock("@/actions/subscriptions/subscription-seat-management", () => ({
  getSeatDetails: vi.fn().mockResolvedValue({ success: true, data: null }),
  assignSeatUsers: vi.fn(),
  unassignSeatUser: vi.fn(),
  syncUsedLicenses: vi.fn(),
}));

// Tabs: render every panel so the overview assertions below keep working
vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => (
    <div role="tablist">{children}</div>
  ),
  TabsTrigger: ({ children }: { children: React.ReactNode }) => (
    <button type="button" role="tab">
      {children}
    </button>
  ),
  TabsContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

// Lifecycle sub-components exercised in their own tests
vi.mock("./subscription-status-actions", () => ({
  SubscriptionStatusActions: ({
    subscriptionId,
  }: {
    subscriptionId: string;
  }) => (
    <div>
      <a href={`/subscriptions/${subscriptionId}/edit`}>Edit</a>
      <button type="button">Delete</button>
    </div>
  ),
}));
vi.mock("./subscription-attachments", () => ({
  SubscriptionAttachments: () => <div data-testid="attachments" />,
}));
vi.mock("./subscription-comments", () => ({
  SubscriptionComments: () => <div data-testid="comments" />,
}));
vi.mock("./subscription-activity", () => ({
  SubscriptionActivity: () => <div data-testid="activity" />,
}));
vi.mock("./price-change-alerts", () => ({
  PriceChangeAlerts: () => null,
}));
vi.mock("./subscription-detail-cancellation", () => ({
  SubscriptionDetailCancellation: () => <div data-testid="cancellation" />,
}));

// Mock notification-settings action
vi.mock("@/actions/notification-settings", () => ({
  updateNotificationSettings: vi.fn().mockResolvedValue({ success: true }),
}));

const mockSubscription: SubscriptionDetailType = {
  id: "sub-1",
  appId: "app-1",
  appName: "Slack",
  appLogoUrl: "https://example.com/slack.png",
  status: "ACTIVE",
  billingCycle: "MONTHLY",
  billingType: "FLAT_RATE",
  amount: 10000,
  perSeatPrice: null,
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
  teamId: "team-1",
  teamName: "Engineering",
  team: { id: "team-1", name: "Engineering" },
  teams: [{ id: "team-1", name: "Engineering" }],
  assignedUsers: [],
  category: null,
  tags: [],
  owner: null,
  isPersonal: false,
  isTrial: false,
  trialEndsAt: null,
  cancellationDeadline: null,
  paymentMethod: null,
  costCenter: null,
  noticePeriodDays: null,
  reminderLeadDays: [],
  pausedAt: null,
  archivedAt: null,
  lastDetectedAmount: null,
  cancellationUrl: null,
  cancellationNotes: null,
  taxRate: null,
  customFieldValues: [],
  app: {
    catalogId: null,
    website: null,
    cancellationUrl: null,
    cancellationNotes: null,
  },
};

const renderWithWait = async (
  subscription: SubscriptionDetailType = mockSubscription
) => {
  render(<SubscriptionDetail subscription={subscription} />);
  // To avoid act warnings from async state updates (useEffect),
  // wait until the main text appears
  await screen.findByText(subscription.appName);
};

describe("SubscriptionDetail", () => {
  it("shows the basic subscription info", async () => {
    await renderWithWait();

    expect(screen.getAllByText("Slack").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Active").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Monthly").length).toBeGreaterThanOrEqual(1);
  });

  it("shows the formatted amount", async () => {
    await renderWithWait();

    expect(screen.getAllByText("₩10,000").length).toBeGreaterThanOrEqual(1);
  });

  it("shows the license info", async () => {
    await renderWithWait();

    expect(screen.getByText("80/100")).toBeInTheDocument();
  });

  it("shows the date info", async () => {
    await renderWithWait();

    expect(screen.getAllByText("2024.01.01").length).toBeGreaterThanOrEqual(1); // Start date
    expect(screen.getAllByText("2024.02.01").length).toBeGreaterThanOrEqual(1); // Renewal date
  });

  it("shows the auto-renewal status", async () => {
    await renderWithWait();

    // Auto-renewal badge is shown (both the label and the badge exist)
    const autoRenewalElements = screen.getAllByText("Auto renewal");
    expect(autoRenewalElements.length).toBeGreaterThanOrEqual(1);
  });

  it("shows the renewal alert settings", async () => {
    await renderWithWait();

    // Labels from the NotificationSettings component
    expect(screen.getByText("30 days before alert")).toBeInTheDocument();
    expect(screen.getByText("60 days before alert")).toBeInTheDocument();
    expect(screen.getByText("90 days before alert")).toBeInTheDocument();
  });

  it("shows notes when present", async () => {
    await renderWithWait();

    expect(screen.getByText("This is a test note")).toBeInTheDocument();
  });

  it("shows the contract link when present", async () => {
    await renderWithWait();

    const contractLink = screen.getByRole("link", { name: /View contract/i });
    expect(contractLink).toHaveAttribute(
      "href",
      "https://example.com/contract.pdf"
    );
  });

  it("has an edit link", async () => {
    await renderWithWait();

    const editLink = screen.getByRole("link", { name: /Edit/i });
    expect(editLink).toHaveAttribute("href", "/subscriptions/sub-1/edit");
  });

  it("has a delete button", async () => {
    await renderWithWait();

    expect(screen.getByRole("button", { name: /Delete/i })).toBeInTheDocument();
  });

  it("shows the logo image when a logo URL is present", async () => {
    await renderWithWait();

    const img = screen.getByAltText("Slack");
    expect(img).toHaveAttribute("src", "https://example.com/slack.png");
  });

  it("shows - when there are no licenses", async () => {
    const subscriptionWithoutLicense = {
      ...mockSubscription,
      totalLicenses: null,
      usedLicenses: null,
    };
    await renderWithWait(subscriptionWithoutLicense);

    // Check "-" in the license row
    expect(screen.getAllByText("-").length).toBeGreaterThan(0);
  });
});
