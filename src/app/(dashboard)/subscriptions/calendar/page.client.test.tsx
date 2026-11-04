// src/app/(dashboard)/subscriptions/calendar/page.client.test.tsx
import type { CalendarWithMarkers } from "@/actions/discovery/calendar-extras";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RenewalCalendarPageClient } from "./page.client";

const { push, searchParams, getRenewalCalendarWithMarkers, getRenewalsByDate } =
  vi.hoisted(() => ({
    push: vi.fn(),
    searchParams: { current: new URLSearchParams() },
    getRenewalCalendarWithMarkers: vi.fn(),
    getRenewalsByDate: vi.fn(),
  }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => searchParams.current,
  usePathname: () => "/subscriptions/calendar",
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
vi.mock("@/actions/discovery/calendar-extras", () => ({
  getRenewalCalendarWithMarkers: (...a: unknown[]) =>
    getRenewalCalendarWithMarkers(...a),
}));
vi.mock("@/actions/subscriptions", () => ({
  getRenewalsByDate: (...a: unknown[]) => getRenewalsByDate(...a),
}));

const initialData: CalendarWithMarkers = {
  year: 2026,
  month: 11,
  scope: "workspace",
  renewals: {
    "2026-11-10": [
      {
        subscriptionId: "s1",
        appId: "a1",
        appName: "Slack",
        appLogo: null,
        planName: null,
        amount: 100,
        currency: "AED",
        renewalDate: "2026-11-10T00:00:00.000Z",
        status: "ACTIVE",
      },
    ],
  },
  markers: {
    "2026-11-12": [
      {
        kind: "trialEnd",
        subscriptionId: "s2",
        appName: "Notion",
        appLogoUrl: null,
        date: "2026-11-12",
        amount: 5,
        currency: "AED",
      },
      {
        kind: "cancellationDeadline",
        subscriptionId: "s3",
        appName: "Jira",
        appLogoUrl: null,
        date: "2026-11-12",
        amount: 9,
        currency: "AED",
      },
    ],
  },
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <RenewalCalendarPageClient initialData={initialData} />
    </QueryClientProvider>
  );
}

describe("RenewalCalendarPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParams.current = new URLSearchParams("year=2026&month=11");
    getRenewalsByDate.mockResolvedValue({
      date: "2026-11-10",
      renewals: initialData.renewals["2026-11-10"],
    });
  });

  it("renders renewal badges and distinct trial/notice markers from the initial data", () => {
    renderPage();
    expect(screen.getByTestId("day-10")).toContainElement(
      screen.getByTestId("renewal-badge")
    );
    const markers = screen.getByTestId("calendar-markers");
    expect(screen.getByTestId("day-12")).toContainElement(markers);
    expect(markers.querySelectorAll("span")).toHaveLength(2);
    expect(getRenewalCalendarWithMarkers).not.toHaveBeenCalled();
  });

  it("loads the selected day and shows its renewals plus markers", async () => {
    renderPage();
    fireEvent.click(screen.getByTestId("day-12"));
    await waitFor(() =>
      expect(getRenewalsByDate).toHaveBeenCalledWith("2026-11-12")
    );
    expect(await screen.findByTestId("day-markers")).toHaveTextContent(
      "Notion"
    );
    expect(screen.getByTestId("day-markers")).toHaveTextContent("Jira");
  });

  it("navigates months through the URL and clears the selection", () => {
    renderPage();
    fireEvent.click(screen.getByTestId("day-10"));
    fireEvent.click(screen.getByText("다음"));
    expect(push).toHaveBeenCalledWith(
      "/subscriptions/calendar?year=2026&month=12"
    );
  });

  it("fetches marker-aware data when the URL month differs from the initial data", async () => {
    searchParams.current = new URLSearchParams("year=2026&month=12");
    getRenewalCalendarWithMarkers.mockResolvedValue({
      success: true,
      data: { ...initialData, month: 12, renewals: {}, markers: {} },
    });
    renderPage();
    await waitFor(() =>
      expect(getRenewalCalendarWithMarkers).toHaveBeenCalledWith(2026, 12)
    );
  });
});
