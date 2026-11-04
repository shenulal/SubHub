// src/components/receipts/receipt-suggestion-row.test.tsx
import type { ReceiptSuggestionDTO } from "@/types/receipts";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReceiptSuggestionRow } from "./receipt-suggestion-row";

const base: ReceiptSuggestionDTO = {
  id: "sug-1",
  mailboxId: "mb-1",
  mailboxEmail: "me@acme.com",
  provider: "GMAIL",
  messageId: "m1",
  vendorName: "Notion",
  senderEmail: "team@notion.so",
  subject: "Your Notion receipt",
  amount: 12,
  currency: "USD",
  billingCycle: "MONTHLY",
  chargedAt: "2026-01-05T00:00:00.000Z",
  nextRenewalAt: "2026-02-05T00:00:00.000Z",
  confidence: 0.91,
  snippet: "Thanks for your payment. Amount charged: $12.00",
  status: "NEW",
  matchedCatalog: {
    id: "cat",
    name: "Notion",
    logoUrl: null,
    category: "Productivity",
    website: null,
  },
  matchedSubscription: null,
  createdAt: "2026-01-05T01:00:00.000Z",
};

function renderRow(
  overrides: Partial<ReceiptSuggestionDTO> = {},
  props: Partial<React.ComponentProps<typeof ReceiptSuggestionRow>> = {}
) {
  const handlers = {
    onSelect: vi.fn(),
    onAccept: vi.fn(),
    onLink: vi.fn(),
    onDismiss: vi.fn(),
  };
  render(
    <table>
      <tbody>
        <ReceiptSuggestionRow
          suggestion={{ ...base, ...overrides }}
          selected={false}
          canCreate
          busy={false}
          {...handlers}
          {...props}
        />
      </tbody>
    </table>
  );
  return handlers;
}

describe("ReceiptSuggestionRow", () => {
  it("renders vendor, amount, cycle, renewal, confidence and catalog badge", () => {
    renderRow();
    expect(screen.getByText("Notion")).toBeInTheDocument();
    expect(screen.getByText(/USD\s?12\.00/)).toBeInTheDocument();
    expect(screen.getByText("Monthly")).toBeInTheDocument();
    expect(screen.getByText(/Feb 5, 2026/)).toBeInTheDocument();
    expect(screen.getByRole("meter")).toHaveAttribute("data-level", "high");
    expect(screen.getByText("In catalog")).toBeInTheDocument();
  });

  it("fires accept, link, dismiss and select handlers", () => {
    const h = renderRow();
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    fireEvent.click(screen.getByRole("button", { name: "Link to existing" }));
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Notion" }));
    expect(h.onAccept).toHaveBeenCalledTimes(1);
    expect(h.onLink).toHaveBeenCalledTimes(1);
    expect(h.onDismiss).toHaveBeenCalledTimes(1);
    expect(h.onSelect).toHaveBeenCalledWith(true);
  });

  it("toggles the snippet expander", () => {
    renderRow();
    expect(screen.queryByText(/Amount charged: \$12\.00/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show email snippet" }));
    expect(screen.getByText(/Amount charged: \$12\.00/)).toBeInTheDocument();
    expect(screen.getByText(/From team@notion.so/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hide email snippet" }));
    expect(screen.queryByText(/Amount charged: \$12\.00/)).toBeNull();
  });

  it("hides decision actions for decided suggestions and without create permission", () => {
    renderRow({ status: "DISMISSED" });
    expect(screen.queryByRole("button", { name: "Accept" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("hides Accept when the member cannot create subscriptions", () => {
    renderRow({}, { canCreate: false });
    expect(screen.queryByRole("button", { name: "Accept" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Link to existing" })
    ).toBeInTheDocument();
  });

  it("shows duplicate and price-drift badges from the matched subscription", () => {
    renderRow({
      status: "DUPLICATE",
      matchedSubscription: {
        id: "s",
        appName: "Notion",
        amount: 12,
        currency: "USD",
      },
    });
    expect(screen.getByText("Duplicate of Notion")).toBeInTheDocument();
    expect(screen.queryByText(/Price differs/)).toBeNull();
  });

  it("flags price drift for a matched but not duplicate subscription", () => {
    renderRow({
      matchedSubscription: {
        id: "s",
        appName: "Notion",
        amount: 10,
        currency: "USD",
      },
    });
    expect(screen.getByText("Looks like Notion")).toBeInTheDocument();
    expect(
      screen.getByText(/Price differs from USD\s?10\.00/)
    ).toBeInTheDocument();
  });

  it("renders a placeholder when the amount is unknown", () => {
    renderRow({
      amount: null,
      currency: null,
      billingCycle: null,
      nextRenewalAt: null,
      chargedAt: null,
    });
    expect(screen.getByText("Amount not detected")).toBeInTheDocument();
  });
});
