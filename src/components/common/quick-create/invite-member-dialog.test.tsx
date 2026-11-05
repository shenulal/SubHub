// src/components/common/quick-create/invite-member-dialog.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InviteMemberDialog } from "./invite-member-dialog";

const { createInvitation, toastSuccess } = vi.hoisted(() => ({
  createInvitation: vi.fn(),
  toastSuccess: vi.fn(),
}));
vi.mock("@/actions/invitations", () => ({ createInvitation }));
vi.mock("@/actions/teams", () => ({
  getTeams: vi.fn().mockResolvedValue({
    success: true,
    data: [{ id: "t1", name: "Finance" }],
  }),
}));
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: vi.fn() } }));

describe("InviteMemberDialog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("prefills a typed email and reports the invitation as sent", async () => {
    createInvitation.mockResolvedValue({ success: true });
    const onInvited = vi.fn();
    render(
      <InviteMemberDialog
        open
        onOpenChange={vi.fn()}
        defaultEmail="sara@acme.ae"
        defaultTeamId="t1"
        onInvited={onInvited}
      />
    );

    expect(screen.getByLabelText(/email address/i)).toHaveValue("sara@acme.ae");
    await userEvent.click(
      screen.getByRole("button", { name: "Send invitation" })
    );

    await waitFor(() => expect(onInvited).toHaveBeenCalledWith("sara@acme.ae"));
    expect(createInvitation).toHaveBeenCalledWith({
      email: "sara@acme.ae",
      role: "MEMBER",
      teamId: "t1",
    });
    expect(toastSuccess).toHaveBeenCalledWith(
      expect.stringContaining("Invitation sent to sara@acme.ae")
    );
  });

  it("ignores a typed name that is not an email and validates inline", async () => {
    render(
      <InviteMemberDialog open onOpenChange={vi.fn()} defaultEmail="Sara" />
    );
    expect(screen.getByLabelText(/email address/i)).toHaveValue("");
    await userEvent.type(screen.getByLabelText(/email address/i), "sara");
    await userEvent.click(
      screen.getByRole("button", { name: "Send invitation" })
    );

    expect(
      await screen.findByText("Enter a valid email address")
    ).toBeInTheDocument();
    expect(createInvitation).not.toHaveBeenCalled();
  });

  it("shows the server's refusal under the field", async () => {
    createInvitation.mockResolvedValue({
      success: false,
      message: "You do not have permission to invite members",
    });
    render(
      <InviteMemberDialog open onOpenChange={vi.fn()} defaultEmail="a@b.ae" />
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Send invitation" })
    );
    expect(
      await screen.findByText("You do not have permission to invite members")
    ).toBeInTheDocument();
  });
});
