// src/components/approvals/approval-row-actions.test.tsx
import type { ApprovalRequestListItem } from "@/types/approval";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApprovalRowActions } from "./approval-row-actions";

const row = {
  id: "req-1",
  serviceName: "Miro",
  canDecide: true,
} as ApprovalRequestListItem;

describe("ApprovalRowActions", () => {
  it("offers Approve / Reject / Request info when the viewer can decide", async () => {
    const onDecide = vi.fn();
    render(<ApprovalRowActions row={row} onDecide={onDecide} />);
    await userEvent.click(screen.getByRole("button", { name: "Approve Miro" }));
    expect(onDecide).toHaveBeenLastCalledWith("approve", row);
    await userEvent.click(screen.getByRole("button", { name: "Reject Miro" }));
    expect(onDecide).toHaveBeenLastCalledWith("reject", row);
    await userEvent.click(
      screen.getByRole("button", { name: "More actions for Miro" })
    );
    await userEvent.click(await screen.findByText("Request info"));
    expect(onDecide).toHaveBeenLastCalledWith("requestInfo", row);
    expect(screen.queryByText("Open request")).toBeNull();
  });

  it("only links to the request when the viewer cannot decide", () => {
    render(
      <ApprovalRowActions
        row={{ ...row, canDecide: false }}
        onDecide={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: /Approve/ })).toBeNull();
    expect(screen.getByRole("link", { name: "Open request" })).toHaveAttribute(
      "href",
      "/approvals/req-1"
    );
  });
});
