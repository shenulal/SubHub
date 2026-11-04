// src/components/approvals/approval-timeline.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ApprovalTimeline } from "./approval-timeline";

const actor = { id: "u1", name: "Rania", email: "r@acme.test" };

describe("ApprovalTimeline", () => {
  it("renders actor events, system events and comments", () => {
    render(
      <ApprovalTimeline
        events={[
          {
            id: "e1",
            type: "SUBMITTED",
            comment: null,
            metadata: null,
            createdAt: "2026-03-01T10:00:00Z",
            actor,
          },
          {
            id: "e2",
            type: "COMMENTED",
            comment: "Any discount?",
            metadata: null,
            createdAt: "2026-03-01T11:00:00Z",
            actor,
          },
          {
            id: "e3",
            type: "APPROVED",
            comment: null,
            metadata: { autoApproved: true },
            createdAt: "2026-03-01T12:00:00Z",
            actor: null,
          },
          {
            id: "e4",
            type: "CANCELLED",
            comment: null,
            metadata: { expired: true },
            createdAt: "2026-03-02T12:00:00Z",
            actor: null,
          },
        ]}
      />
    );
    expect(screen.getAllByText("Rania")).toHaveLength(2);
    expect(screen.getByText("submitted the request")).toBeInTheDocument();
    expect(screen.getByText("Any discount?")).toBeInTheDocument();
    expect(screen.getByText("Approved automatically")).toBeInTheDocument();
    expect(screen.getByText(/no decision in time/)).toBeInTheDocument();
  });
});
