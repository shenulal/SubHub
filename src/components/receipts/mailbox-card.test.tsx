// src/components/receipts/mailbox-card.test.tsx
import type { MailboxConnectionDTO } from "@/types/receipts";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MailboxCard } from "./mailbox-card";

const mailbox: MailboxConnectionDTO = {
  id: "mb-1",
  provider: "GMAIL",
  email: "me@acme.com",
  status: "ACTIVE",
  lastScannedAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
  errorMessage: null,
  suggestionCount: 4,
  newSuggestionCount: 2,
  ownerName: "Shenu",
  ownerEmail: "me@acme.com",
  isOwn: true,
  createdAt: new Date().toISOString(),
};

describe("MailboxCard", () => {
  it("renders the address, provider, status and counters", () => {
    render(
      <MailboxCard
        mailbox={mailbox}
        onScan={vi.fn()}
        onDisconnect={vi.fn()}
        scanning={false}
      />
    );
    expect(
      screen.getByRole("heading", { name: "me@acme.com" })
    ).toBeInTheDocument();
    expect(screen.getByText("Gmail")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    // The next-intl test stub does not evaluate ICU plurals; assert the link carries the counter.
    expect(screen.getByRole("link", { name: /suggestion/ })).toHaveAttribute(
      "href",
      "/subscriptions/receipts"
    );
    expect(screen.getByText(/2 new/)).toBeInTheDocument();
    expect(screen.getByText("2 hours ago")).toBeInTheDocument();
  });

  it("wires scan and disconnect buttons", () => {
    const onScan = vi.fn();
    const onDisconnect = vi.fn();
    render(
      <MailboxCard
        mailbox={mailbox}
        onScan={onScan}
        onDisconnect={onDisconnect}
        scanning={false}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Scan now/ }));
    fireEvent.click(screen.getByRole("button", { name: /Disconnect/ }));
    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onDisconnect).toHaveBeenCalledTimes(1);
  });

  it("shows the error message, owner, and a reconnect link when revoked", () => {
    render(
      <MailboxCard
        mailbox={{
          ...mailbox,
          status: "REVOKED",
          errorMessage: "invalid_grant",
          isOwn: false,
          lastScannedAt: null,
        }}
        onScan={vi.fn()}
        onDisconnect={vi.fn()}
        scanning={false}
        showOwner
      />
    );
    expect(screen.getByText("invalid_grant")).toBeInTheDocument();
    expect(screen.getByText("Shenu")).toBeInTheDocument();
    expect(screen.getByText("Never")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reconnect" })).toHaveAttribute(
      "href",
      "/api/integrations/mailbox/gmail/connect"
    );
    expect(screen.queryByRole("button", { name: /Scan now/ })).toBeNull();
  });

  it("disables actions while scanning", () => {
    render(
      <MailboxCard
        mailbox={mailbox}
        onScan={vi.fn()}
        onDisconnect={vi.fn()}
        scanning
      />
    );
    expect(screen.getByRole("button", { name: /Scanning/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Disconnect/ })).toBeDisabled();
  });
});
