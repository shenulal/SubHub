import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SubscriptionContractCard } from "./subscription-contract-card";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

const base = {
  startDate: new Date("2026-01-01T00:00:00Z"),
  endDate: new Date("2026-12-31T00:00:00Z"),
  autoRenewal: true,
  noticePeriodDays: 30,
  reminderLeadDays: [1, 7],
  windowDays: 7,
};

describe("SubscriptionContractCard", () => {
  it("shows the notice window as open with a countdown", () => {
    render(
      <SubscriptionContractCard
        {...base}
        cancellationDeadline={new Date("2026-12-01T00:00:00Z")}
        now={new Date("2026-11-28T10:00:00Z")}
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      'countdown.window_open:{"days":3}'
    );
    expect(screen.getByText("windowOpenHint")).toBeInTheDocument();
    expect(screen.getByText('reminderLead:{"days":7}')).toBeInTheDocument();
  });

  it("shows upcoming state without the alert role", () => {
    render(
      <SubscriptionContractCard
        {...base}
        cancellationDeadline={new Date("2026-12-01T00:00:00Z")}
        now={new Date("2026-10-01T00:00:00Z")}
      />
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.getByText('countdown.upcoming:{"days":61}')
    ).toBeInTheDocument();
  });

  it("explains how to get a deadline when none is set", () => {
    render(
      <SubscriptionContractCard
        {...base}
        endDate={null}
        noticePeriodDays={null}
        cancellationDeadline={null}
        reminderLeadDays={[]}
      />
    );
    expect(
      screen.getByText('countdown.no_deadline:{"days":0}')
    ).toBeInTheDocument();
    expect(screen.getByText("noEnd")).toBeInTheDocument();
  });
});
