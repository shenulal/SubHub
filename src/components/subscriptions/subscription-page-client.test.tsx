// src/components/subscriptions/subscription-page-client.test.tsx
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  SubscriptionPageClient,
  type SubscriptionPageClientProps,
} from "./subscription-page-client";
import { filterOptions, makeSubscription } from "./test-fixtures";

const {
  push,
  searchParams,
  exportSubscriptionsCsv,
  getMatchingSubscriptionIds,
} = vi.hoisted(() => ({
  push: vi.fn(),
  searchParams: { current: new URLSearchParams() },
  exportSubscriptionsCsv: vi.fn(),
  getMatchingSubscriptionIds: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/subscriptions",
  useSearchParams: () => searchParams.current,
}));
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
vi.mock("@/actions/discovery/export", () => ({
  exportSubscriptionsCsv: (...a: unknown[]) => exportSubscriptionsCsv(...a),
}));
vi.mock("@/actions/discovery/list", () => ({
  getMatchingSubscriptionIds: (...a: unknown[]) =>
    getMatchingSubscriptionIds(...a),
}));
vi.mock("@/actions/discovery/saved-views", () => ({
  createSavedView: vi.fn(),
  updateSavedView: vi.fn(),
  deleteSavedView: vi.fn(),
  setDefaultView: vi.fn(),
}));
vi.mock("@/actions/subscriptions", () => ({ deleteSubscription: vi.fn() }));
vi.mock("@/actions/subscriptions/subscription-lifecycle", () => ({
  pauseSubscription: vi.fn(),
  resumeSubscription: vi.fn(),
  archiveSubscription: vi.fn(),
  restoreSubscription: vi.fn(),
  bulkUpdateSubscriptions: vi.fn(),
}));
vi.mock("@/components/taxonomy/category-badge", () => ({
  CategoryBadge: ({ category }: { category: { name: string } | null }) => (
    <span>{category?.name}</span>
  ),
}));
vi.mock("@/lib/services/export/csv", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/services/export/csv")>()),
  downloadCSV: vi.fn(),
}));

function baseProps(
  overrides: Partial<SubscriptionPageClientProps> = {}
): SubscriptionPageClientProps {
  return {
    items: [
      makeSubscription(),
      makeSubscription({ id: "sub-2", appName: "Notion" }),
    ],
    total: 42,
    totalPages: 3,
    monthlyTotalBase: 1234.5,
    baseCurrency: "AED",
    hasStaleRates: false,
    pageSizeOptions: [10, 20, 50],
    defaultPageSize: 20,
    options: filterOptions,
    savedViews: [
      {
        id: "v1",
        entity: "subscriptions",
        name: "Active only",
        filters: { statuses: ["ACTIVE"] },
        sort: null,
        isShared: false,
        isOwner: true,
        isDefault: false,
        createdAt: "",
        updatedAt: "",
      },
    ],
    canSelect: true,
    ...overrides,
  };
}

describe("SubscriptionPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParams.current = new URLSearchParams();
    Element.prototype.scrollIntoView = vi.fn();
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  });

  it("renders the summary with count and monthly base total", () => {
    render(<SubscriptionPageClient {...baseProps()} />);
    expect(screen.getByText(/42 subscriptions/)).toHaveTextContent("AED");
    expect(screen.getByText("Slack")).toBeInTheDocument();
    expect(screen.getByText("Notion")).toBeInTheDocument();
  });

  it("writes filter changes to the URL and resets the page", () => {
    searchParams.current = new URLSearchParams("page=3&q=old");
    render(<SubscriptionPageClient {...baseProps()} />);
    const filters = within(screen.getByTestId("subscription-filters"));
    fireEvent.click(filters.getByRole("combobox", { name: "Status" }));
    fireEvent.click(screen.getByRole("option", { name: /Paused/ }));
    expect(push).toHaveBeenCalledTimes(1);
    const url = push.mock.calls[0][0] as string;
    expect(url).toContain("status=PAUSED");
    expect(url).toContain("q=old");
    expect(url).not.toContain("page=3");
  });

  it("applies a saved view by navigating to its serialised query", () => {
    render(<SubscriptionPageClient {...baseProps()} />);
    fireEvent.click(screen.getByText("Active only"));
    expect(push).toHaveBeenCalledWith("/subscriptions?status=ACTIVE");
  });

  it("marks the matching saved view as active from the URL", () => {
    searchParams.current = new URLSearchParams("status=ACTIVE");
    render(<SubscriptionPageClient {...baseProps()} />);
    expect(screen.getByText("Active only").closest("button")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("exports the current filter as CSV", async () => {
    searchParams.current = new URLSearchParams(
      "status=ACTIVE&sort=amount&order=desc"
    );
    exportSubscriptionsCsv.mockResolvedValue({
      success: true,
      data: { csv: "a,b", filename: "x.csv", rowCount: 2 },
    });
    render(<SubscriptionPageClient {...baseProps()} />);
    fireEvent.click(screen.getByText("Export CSV"));
    await waitFor(() => expect(exportSubscriptionsCsv).toHaveBeenCalled());
    expect(exportSubscriptionsCsv).toHaveBeenCalledWith({
      filter: { statuses: ["ACTIVE"] },
      sort: { sortBy: "amount", sortOrder: "desc" },
    });
  });

  it("shows the bulk bar once rows are selected and can select all matching", async () => {
    getMatchingSubscriptionIds.mockResolvedValue({
      success: true,
      data: { ids: ["a", "b", "c"], capped: false },
    });
    render(
      <SubscriptionPageClient
        {...baseProps({ items: [makeSubscription()], total: 3 })}
      />
    );
    expect(
      screen.queryByTestId("subscription-bulk-bar")
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    expect(screen.getByTestId("subscription-bulk-bar")).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Select all 3 matching/));
    await waitFor(() =>
      expect(screen.getByText("All matching rows selected")).toBeInTheDocument()
    );
    expect(screen.getByTestId("subscription-bulk-bar")).toHaveTextContent("3");
  });

  it("surfaces a server error inline", () => {
    render(
      <SubscriptionPageClient
        {...baseProps({
          items: [],
          total: 0,
          error: "Could not load subscriptions",
        })}
      />
    );
    expect(
      screen.getByText("Could not load subscriptions")
    ).toBeInTheDocument();
  });
});
