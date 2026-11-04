// src/components/receipts/mailboxes-settings-client.test.tsx
import {
  disconnectMailbox,
  getMailboxes,
  scanMailboxNow,
} from "@/actions/receipts";
import type { MailboxConnectionDTO } from "@/types/receipts";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MailboxesSettingsClient } from "./mailboxes-settings-client";

vi.mock("@/actions/receipts", () => ({
  getMailboxes: vi.fn(),
  scanMailboxNow: vi.fn(),
  disconnectMailbox: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const own: MailboxConnectionDTO = {
  id: "mb-1",
  provider: "GMAIL",
  email: "me@acme.com",
  status: "ACTIVE",
  lastScannedAt: null,
  errorMessage: null,
  suggestionCount: 1,
  newSuggestionCount: 1,
  ownerName: "Me",
  ownerEmail: "me@acme.com",
  isOwn: true,
  createdAt: "",
};
const other: MailboxConnectionDTO = {
  ...own,
  id: "mb-2",
  email: "cfo@acme.com",
  provider: "OUTLOOK",
  isOwn: false,
  ownerName: "CFO",
};

describe("MailboxesSettingsClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMailboxes).mockResolvedValue({ success: true, data: [own] });
  });

  it("renders connect buttons, disabling providers without credentials", () => {
    render(
      <MailboxesSettingsClient
        initialMailboxes={[own]}
        availability={{ gmail: true, outlook: false }}
        canManageAll={false}
      />
    );
    expect(screen.getByRole("link", { name: /Connect Gmail/ })).toHaveAttribute(
      "href",
      "/api/integrations/mailbox/gmail/connect"
    );
    expect(
      screen.getByRole("button", { name: /Connect Outlook/ })
    ).toBeDisabled();
    expect(
      screen.getByText(/Outlook OAuth client is not configured/)
    ).toBeInTheDocument();
    expect(screen.getByText("What SubHub reads")).toBeInTheDocument();
  });

  it("shows other members' mailboxes only for managers", () => {
    const { rerender } = render(
      <MailboxesSettingsClient
        initialMailboxes={[own, other]}
        availability={{ gmail: true, outlook: true }}
        canManageAll={false}
      />
    );
    expect(screen.queryByText("cfo@acme.com")).toBeNull();
    rerender(
      <MailboxesSettingsClient
        initialMailboxes={[own, other]}
        availability={{ gmail: true, outlook: true }}
        canManageAll
      />
    );
    expect(screen.getByText("cfo@acme.com")).toBeInTheDocument();
    expect(screen.getByText("All organisation mailboxes")).toBeInTheDocument();
  });

  it("runs a scan and refreshes the list", async () => {
    vi.mocked(scanMailboxNow).mockResolvedValue({
      success: true,
      data: {
        connectionId: "mb-1",
        fetched: 5,
        parsed: 5,
        belowThreshold: 1,
        created: 2,
        updated: 0,
        duplicates: 0,
        priceChanges: 0,
      },
    });
    render(
      <MailboxesSettingsClient
        initialMailboxes={[own]}
        availability={{ gmail: true, outlook: true }}
        canManageAll={false}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Scan now/ }));
    await waitFor(() => expect(scanMailboxNow).toHaveBeenCalledWith("mb-1"));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(getMailboxes).toHaveBeenCalled();
  });

  it("reports scan failures", async () => {
    vi.mocked(scanMailboxNow).mockResolvedValue({
      success: false,
      error: "quota",
    });
    render(
      <MailboxesSettingsClient
        initialMailboxes={[own]}
        availability={{ gmail: true, outlook: true }}
        canManageAll={false}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Scan now/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });

  it("asks for confirmation before disconnecting", async () => {
    vi.mocked(disconnectMailbox).mockResolvedValue({ success: true });
    vi.mocked(getMailboxes).mockResolvedValue({ success: true, data: [] });
    render(
      <MailboxesSettingsClient
        initialMailboxes={[own]}
        availability={{ gmail: true, outlook: true }}
        canManageAll={false}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Disconnect/ }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Disconnect me@acme.com?");
    fireEvent.click(
      screen.getAllByRole("button", { name: "Disconnect" }).at(-1)!
    );
    await waitFor(() => expect(disconnectMailbox).toHaveBeenCalledWith("mb-1"));
    await waitFor(() =>
      expect(
        screen.getByText("No mailboxes connected yet.")
      ).toBeInTheDocument()
    );
  });
});
