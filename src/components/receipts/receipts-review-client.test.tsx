// src/components/receipts/receipts-review-client.test.tsx
import type { ReceiptSuggestionPage } from "@/actions/receipts";
import {
  dismissReceiptSuggestions,
  getReceiptSuggestions,
} from "@/actions/receipts";
import type { ReceiptSuggestionDTO } from "@/types/receipts";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReceiptsReviewClient } from "./receipts-review-client";

vi.mock("@/actions/receipts", () => ({
  getReceiptSuggestions: vi.fn(),
  dismissReceiptSuggestions: vi.fn(),
  getLinkableSubscriptions: vi
    .fn()
    .mockResolvedValue({ success: true, data: [] }),
  linkReceiptSuggestion: vi.fn(),
  acceptReceiptSuggestion: vi.fn(),
}));
vi.mock("@/actions/taxonomy/auto-categorize", () => ({
  suggestCategory: vi
    .fn()
    .mockResolvedValue({
      categoryId: "cat-prod",
      parentId: null,
      confidence: 0.9,
      reason: "catalog",
    }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const item = (
  id: string,
  overrides: Partial<ReceiptSuggestionDTO> = {}
): ReceiptSuggestionDTO => ({
  id,
  mailboxId: "mb-1",
  mailboxEmail: "me@acme.com",
  provider: "GMAIL",
  messageId: id,
  vendorName: `Vendor ${id}`,
  senderEmail: "billing@vendor.io",
  subject: "Receipt",
  amount: 9.99,
  currency: "USD",
  billingCycle: "MONTHLY",
  chargedAt: "2026-01-05T00:00:00.000Z",
  nextRenewalAt: null,
  confidence: 0.8,
  snippet: "snippet",
  status: "NEW",
  matchedCatalog: null,
  matchedSubscription: null,
  createdAt: "2026-01-05T00:00:00.000Z",
  ...overrides,
});

const page: ReceiptSuggestionPage = {
  items: [item("a"), item("b")],
  total: 2,
  page: 1,
  limit: 50,
  counts: { NEW: 2, ACCEPTED: 1, DISMISSED: 3, DUPLICATE: 0 },
};

const mailboxes = [
  {
    id: "mb-1",
    provider: "GMAIL" as const,
    email: "me@acme.com",
    status: "ACTIVE" as const,
    lastScannedAt: null,
    errorMessage: null,
    suggestionCount: 2,
    newSuggestionCount: 2,
    ownerName: null,
    ownerEmail: null,
    isOwn: true,
    createdAt: "",
  },
];

function renderClient(
  initial: ReceiptSuggestionPage = page,
  extra: Partial<React.ComponentProps<typeof ReceiptsReviewClient>> = {}
) {
  return render(
    <ReceiptsReviewClient
      initialPage={initial}
      mailboxes={mailboxes}
      currencies={["AED", "USD"]}
      categories={[{ id: "cat-prod", name: "Productivity" }]}
      canCreate
      {...extra}
    />
  );
}

describe("ReceiptsReviewClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getReceiptSuggestions).mockResolvedValue({
      success: true,
      data: page,
    });
    vi.mocked(dismissReceiptSuggestions).mockResolvedValue({
      success: true,
      data: { count: 1 },
    });
  });

  it("renders the initial page with tab counters and rows", () => {
    renderClient();
    expect(
      screen.getByRole("heading", { name: "Receipt suggestions" })
    ).toBeInTheDocument();
    expect(screen.getByText("Vendor a")).toBeInTheDocument();
    expect(screen.getByText("Vendor b")).toBeInTheDocument();
    expect(screen.getByText("To review")).toBeInTheDocument();
    expect(getReceiptSuggestions).not.toHaveBeenCalled();
  });

  it("switches tabs and reloads with the new status", async () => {
    renderClient();
    fireEvent.click(screen.getByText("Dismissed"));
    await waitFor(() =>
      expect(getReceiptSuggestions).toHaveBeenCalledWith(
        expect.objectContaining({ status: "DISMISSED", page: 1 })
      )
    );
  });

  it("dismisses a single row and shows a toast", async () => {
    renderClient();
    fireEvent.click(screen.getAllByRole("button", { name: "Dismiss" })[0]);
    await waitFor(() =>
      expect(dismissReceiptSuggestions).toHaveBeenCalledWith(["a"])
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(getReceiptSuggestions).toHaveBeenCalled();
  });

  it("supports select-all + bulk dismiss", async () => {
    renderClient();
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Select all on this page" })
    );
    const bulk = await screen.findByRole("button", {
      name: /Dismiss selected/,
    });
    fireEvent.click(bulk);
    await waitFor(() =>
      expect(dismissReceiptSuggestions).toHaveBeenCalledWith(["a", "b"])
    );
  });

  it("opens the accept dialog prefilled from the suggestion", async () => {
    renderClient();
    fireEvent.click(screen.getAllByRole("button", { name: "Accept" })[0]);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Service name")).toHaveValue("Vendor a");
    expect(screen.getByLabelText("Amount")).toHaveValue(9.99);
    expect(screen.getByLabelText("Start date")).toHaveValue("2026-01-05");
  });

  it("opens the link dialog", async () => {
    renderClient();
    fireEvent.click(
      screen.getAllByRole("button", { name: "Link to existing" })[0]
    );
    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "Link to an existing subscription"
    );
  });

  it("shows the empty state with a connect CTA when no mailboxes exist", () => {
    renderClient({ ...page, items: [], total: 0 }, { mailboxes: [] });
    expect(screen.getByText("Nothing to review")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Connect a mailbox" })
    ).toHaveAttribute("href", "/settings/mailboxes");
  });

  it("surfaces load failures as error toasts", async () => {
    vi.mocked(getReceiptSuggestions).mockResolvedValue({
      success: false,
      error: "boom",
    });
    renderClient();
    fireEvent.change(
      screen.getByLabelText("Search vendor, subject or sender"),
      { target: { value: "zoom" } }
    );
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });
});
