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
      <a href={`/subscriptions/${subscriptionId}/edit`}>수정</a>
      <button type="button">삭제</button>
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
  notes: "테스트 메모입니다",
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
  // 비동기 상태 업데이트(useEffect)로 인한 act 경고를 방지하기 위해
  // 주요 텍스트가 나타날 때까지 대기
  await screen.findByText(subscription.appName);
};

describe("SubscriptionDetail", () => {
  it("구독 기본 정보를 표시해야 한다", async () => {
    await renderWithWait();

    expect(screen.getAllByText("Slack").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("활성").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("월간").length).toBeGreaterThanOrEqual(1);
  });

  it("금액을 포맷하여 표시해야 한다", async () => {
    await renderWithWait();

    expect(screen.getAllByText("₩10,000").length).toBeGreaterThanOrEqual(1);
  });

  it("라이선스 정보를 표시해야 한다", async () => {
    await renderWithWait();

    expect(screen.getByText("80/100")).toBeInTheDocument();
  });

  it("날짜 정보를 표시해야 한다", async () => {
    await renderWithWait();

    expect(screen.getAllByText("2024.01.01").length).toBeGreaterThanOrEqual(1); // 시작일
    expect(screen.getAllByText("2024.02.01").length).toBeGreaterThanOrEqual(1); // 갱신일
  });

  it("자동 갱신 상태를 표시해야 한다", async () => {
    await renderWithWait();

    // 자동 갱신 배지가 표시되는지 확인 (레이블과 배지 모두 존재)
    const autoRenewalElements = screen.getAllByText("자동 갱신");
    expect(autoRenewalElements.length).toBeGreaterThanOrEqual(1);
  });

  it("갱신 알림 설정을 표시해야 한다", async () => {
    await renderWithWait();

    // NotificationSettings 컴포넌트의 레이블 확인
    expect(screen.getByText("30일 전 알림")).toBeInTheDocument();
    expect(screen.getByText("60일 전 알림")).toBeInTheDocument();
    expect(screen.getByText("90일 전 알림")).toBeInTheDocument();
  });

  it("메모가 있으면 표시해야 한다", async () => {
    await renderWithWait();

    expect(screen.getByText("테스트 메모입니다")).toBeInTheDocument();
  });

  it("계약서 링크가 있으면 표시해야 한다", async () => {
    await renderWithWait();

    const contractLink = screen.getByRole("link", { name: /계약서 보기/i });
    expect(contractLink).toHaveAttribute(
      "href",
      "https://example.com/contract.pdf"
    );
  });

  it("수정 링크가 있어야 한다", async () => {
    await renderWithWait();

    const editLink = screen.getByRole("link", { name: /수정/i });
    expect(editLink).toHaveAttribute("href", "/subscriptions/sub-1/edit");
  });

  it("삭제 버튼이 있어야 한다", async () => {
    await renderWithWait();

    expect(screen.getByRole("button", { name: /삭제/i })).toBeInTheDocument();
  });

  it("로고 URL이 있으면 이미지를 표시해야 한다", async () => {
    await renderWithWait();

    const img = screen.getByAltText("Slack");
    expect(img).toHaveAttribute("src", "https://example.com/slack.png");
  });

  it("라이선스가 없으면 - 를 표시해야 한다", async () => {
    const subscriptionWithoutLicense = {
      ...mockSubscription,
      totalLicenses: null,
      usedLicenses: null,
    };
    await renderWithWait(subscriptionWithoutLicense);

    // 라이선스 행에서 "-" 확인
    expect(screen.getAllByText("-").length).toBeGreaterThan(0);
  });
});
