// src/components/approvals/approval-status-badge.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  ApprovalStatusBadge,
  ApprovalStepBadge,
} from "./approval-status-badge";

describe("ApprovalStatusBadge", () => {
  it("renders the translated request status", () => {
    render(<ApprovalStatusBadge status="INFO_REQUESTED" />);
    expect(screen.getByText("Info requested")).toBeInTheDocument();
  });

  it("renders step statuses with semantic styling", () => {
    render(<ApprovalStepBadge status="APPROVED" />);
    const badge = screen.getByText("Approved");
    expect(badge.className).toContain("emerald");
  });
});
