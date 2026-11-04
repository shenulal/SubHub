// src/components/subscriptions/renewal-pipeline.test.tsx
import type { RenewalPipelineData } from "@/types/discovery";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RenewalPipeline } from "./renewal-pipeline";

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
  // eslint-disable-next-line @next/next/no-img-element
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
vi.mock("@/actions/subscriptions/subscription-lifecycle", () => ({
  pauseSubscription: vi.fn(),
  archiveSubscription: vi.fn(),
}));

const card = {
  id: "s1",
  appId: "a1",
  appName: "Slack",
  appLogoUrl: null,
  amount: 100,
  currency: "AED",
  monthlyBase: 100,
  annualBase: 1200,
  billingCycle: "MONTHLY" as const,
  status: "ACTIVE" as const,
  dueDate: "2026-11-06T00:00:00.000Z",
  daysLeft: 2,
  owner: { id: "u1", name: "Sara" },
  teamName: null,
  isTrial: false,
  isPersonal: false,
};

const data: RenewalPipelineData = {
  baseCurrency: "AED",
  generatedAt: "2026-11-04T00:00:00.000Z",
  weekDays: 7,
  monthDays: 30,
  hasStaleRates: true,
  lanes: [
    {
      key: "overdue",
      count: 1,
      monthlyBase: 50,
      annualBase: 600,
      cards: [{ ...card, id: "o", appName: "Old", daysLeft: -3 }],
    },
    {
      key: "week",
      count: 1,
      monthlyBase: 100,
      annualBase: 1200,
      cards: [card],
    },
    { key: "month", count: 0, monthlyBase: 0, annualBase: 0, cards: [] },
    { key: "later", count: 0, monthlyBase: 0, annualBase: 0, cards: [] },
    { key: "trialEnding", count: 0, monthlyBase: 0, annualBase: 0, cards: [] },
    {
      key: "noticeDeadline",
      count: 0,
      monthlyBase: 0,
      annualBase: 0,
      cards: [],
    },
  ],
};

describe("RenewalPipeline", () => {
  it("renders all six lanes with counts, totals and cards", () => {
    render(<RenewalPipeline data={data} />);
    for (const key of [
      "overdue",
      "week",
      "month",
      "later",
      "trialEnding",
      "noticeDeadline",
    ]) {
      expect(screen.getByTestId(`pipeline-lane-${key}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId("pipeline-lane-week")).toHaveTextContent(
      "7일 이내"
    );
    expect(screen.getByTestId("pipeline-lane-week")).toHaveTextContent("Slack");
    expect(screen.getByTestId("pipeline-lane-week")).toHaveTextContent(
      "2일 남음"
    );
    expect(screen.getByTestId("pipeline-lane-overdue")).toHaveTextContent(
      "3일 지연"
    );
    expect(screen.getAllByTestId("pipeline-card")).toHaveLength(2);
    expect(
      screen.getByText(/환율이 최신이 아닐 수 있습니다/)
    ).toBeInTheDocument();
  });

  it("toggles between board and list and notifies the parent", () => {
    const onViewChange = vi.fn();
    render(<RenewalPipeline data={data} onViewChange={onViewChange} />);
    expect(screen.getByTestId("renewal-pipeline")).toHaveAttribute(
      "data-view",
      "board"
    );
    fireEvent.click(screen.getByRole("tab", { name: /목록/ }));
    expect(onViewChange).toHaveBeenCalledWith("list");
    expect(screen.getByTestId("renewal-pipeline")).toHaveAttribute(
      "data-view",
      "list"
    );
  });
});
