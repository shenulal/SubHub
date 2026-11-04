// src/components/approvals/approval-steps-list.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ApprovalStepsList } from "./approval-steps-list";

const user = (id: string, name: string) => ({
  id,
  name,
  email: `${id}@acme.test`,
});

describe("ApprovalStepsList", () => {
  it("renders each step with approver, alternates, status and comments", () => {
    render(
      <ApprovalStepsList
        currentStep={2}
        steps={[
          {
            id: "s1",
            stepOrder: 1,
            label: "Manager",
            status: "APPROVED",
            comment: "Fine by me",
            dueAt: null,
            decidedAt: "2026-03-02T00:00:00Z",
            approver: user("m", "Mona"),
            candidates: [],
          },
          {
            id: "s2",
            stepOrder: 2,
            label: "Finance",
            status: "PENDING",
            comment: null,
            dueAt: "2026-03-05T00:00:00Z",
            decidedAt: null,
            approver: user("f1", "Faisal"),
            candidates: [user("f1", "Faisal"), user("f2", "Farah")],
          },
        ]}
      />
    );
    expect(screen.getByText("Manager")).toBeInTheDocument();
    expect(screen.getByText("Fine by me")).toBeInTheDocument();
    expect(screen.getByText(/Mona/)).toBeInTheDocument();
    expect(screen.getByText(/Any of: Farah/)).toBeInTheDocument();
    expect(screen.getByText("Awaiting decision")).toBeInTheDocument();
    expect(screen.getByText(/Reminder due/)).toBeInTheDocument();
  });
});
