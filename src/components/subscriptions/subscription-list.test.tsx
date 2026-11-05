// src/components/subscriptions/subscription-list.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  SubscriptionList,
  type SubscriptionListProps,
} from "./subscription-list";
import { makeSubscription } from "./test-fixtures";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));
vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <img alt={alt} src={src} />
  ),
}));
vi.mock("../../hooks/use-permissions", () => ({
  usePermissions: () => ({
    can: () => true,
    isLoading: false,
    permissions: new Set(),
  }),
}));
vi.mock("@/actions/subscriptions", () => ({ deleteSubscription: vi.fn() }));
vi.mock("@/actions/subscriptions/subscription-lifecycle", () => ({
  pauseSubscription: vi.fn(),
  resumeSubscription: vi.fn(),
  archiveSubscription: vi.fn(),
  restoreSubscription: vi.fn(),
}));
vi.mock("@/components/taxonomy/category-badge", () => ({
  CategoryBadge: ({
    category,
    parentName,
  }: {
    category: { name: string } | null;
    parentName?: string | null;
  }) => (
    <span data-testid="category-badge">
      {[parentName, category?.name].filter(Boolean).join(" / ")}
    </span>
  ),
}));

const NOW = new Date("2026-11-04T00:00:00Z");

function renderList(overrides: Partial<SubscriptionListProps> = {}) {
  const props: SubscriptionListProps = {
    subscriptions: [
      makeSubscription(),
      makeSubscription({
        id: "sub-2",
        appName: "Notion",
        status: "PAUSED",
        currency: "USD",
        amount: 12,
        billingCycle: "YEARLY",
        monthlyAmountBase: 3.67,
        renewalDate: new Date("2026-11-06T00:00:00Z"),
        isTrial: true,
        trialEndsAt: new Date("2026-11-20T00:00:00Z"),
        cancellationDeadline: new Date("2026-11-10T00:00:00Z"),
        tags: [],
        owner: null,
        teamName: "Ops",
      }),
      makeSubscription({
        id: "sub-3",
        appName: "Jira",
        status: "ARCHIVED",
        renewalDate: new Date("2026-11-01T00:00:00Z"),
      }),
    ],
    baseCurrency: "AED",
    sort: { sortBy: "renewalDate", sortOrder: "asc" },
    onSortChange: vi.fn(),
    page: 1,
    limit: 20,
    total: 3,
    pageSizeOptions: [10, 20],
    onPageChange: vi.fn(),
    selectedIds: new Set(),
    onSelectedIdsChange: vi.fn(),
    canSelect: true,
    hasFilters: false,
    onResetFilters: vi.fn(),
    now: NOW,
    ...overrides,
  };
  return { ...render(<SubscriptionList {...props} />), props };
}

describe("SubscriptionList", () => {
  it("shows an empty state with a reset action when filters are active", () => {
    const { props } = renderList({ subscriptions: [], hasFilters: true });
    expect(screen.getByTestId("subscription-list-empty")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Clear filters"));
    expect(props.onResetFilters).toHaveBeenCalled();
  });

  it("renders rows with app links, category badge, tags, owner and status", () => {
    renderList();
    expect(screen.getByText("Slack").closest("a")).toHaveAttribute(
      "href",
      "/subscriptions/sub-1"
    );
    expect(screen.getAllByTestId("category-badge")[0]).toHaveTextContent(
      "Productivity / Chat"
    );
    expect(screen.getAllByText("core").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sara").length).toBeGreaterThan(0);
    expect(screen.getByText("Ops")).toBeInTheDocument(); // team fallback when no owner
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    expect(screen.getByText("Archived")).toBeInTheDocument();
  });

  it("shows the base-currency monthly equivalent, countdown and trial/notice badges", () => {
    renderList();
    expect(screen.getByText(/≈/)).toHaveTextContent("AED");
    expect(screen.getByText("in 2 days")).toBeInTheDocument();
    expect(screen.getByText("3 days overdue")).toBeInTheDocument();
    expect(screen.getByText(/Trial/)).toBeInTheDocument();
    expect(screen.getByText(/Notice by/)).toBeInTheDocument();
  });

  it("maps header sorting to list sort fields", () => {
    const { props } = renderList();
    fireEvent.click(screen.getByText("Cost"));
    expect(props.onSortChange).toHaveBeenCalledWith({
      sortBy: "amount",
      sortOrder: "asc",
    });
  });

  it("emits row selection changes when selectable", () => {
    const { props } = renderList();
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[1]);
    expect(props.onSelectedIdsChange).toHaveBeenCalled();
    const set = vi.mocked(props.onSelectedIdsChange).mock.calls[0][0];
    expect(set.has("sub-1")).toBe(true);
  });

  it("hides selection checkboxes when the viewer cannot bulk-edit", () => {
    renderList({ canSelect: false });
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });
});
