// src/components/approvals/decision/decision-dialog.test.tsx
import { renderWithPermissions } from "@/test/permission-wrapper";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DecisionDialog } from "./decision-dialog";
import type { DecisionKind, DecisionTarget } from "./types";

const actions = vi.hoisted(() => ({
  approveRequest: vi.fn(),
  rejectRequest: vi.fn(),
  requestInfo: vi.fn(),
  provideInfo: vi.fn(),
  cancelRequest: vi.fn(),
}));
const bulkDecideRequests = vi.hoisted(() => vi.fn());
const getDecisionFormOptions = vi.hoisted(() => vi.fn());
vi.mock("@/actions/approvals/decisions", () => actions);
vi.mock("@/actions/approvals/bulk-decisions", () => ({ bulkDecideRequests }));
vi.mock("@/actions/approvals/decision-options", () => ({
  getDecisionFormOptions,
}));
vi.mock("@/actions/platform/masters/cost-centers", () => ({
  createCostCenter: vi.fn(),
}));
vi.mock("@/components/taxonomy/category-picker", () => ({
  CategoryPicker: () => <div data-testid="category-picker" />,
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

const single: DecisionTarget = {
  ids: ["req-1"],
  serviceName: "Miro",
  categoryId: null,
  costCenterId: null,
};

function renderDialog(kind: DecisionKind, target = single, onDone = vi.fn()) {
  const onClose = vi.fn();
  renderWithPermissions(
    <DecisionDialog
      kind={kind}
      target={target}
      onClose={onClose}
      onDone={onDone}
    />,
    ["approvals:decide"]
  );
  return { onClose, onDone };
}

beforeEach(() => {
  vi.clearAllMocks();
  // cmdk (searchable Select) scrolls the active option into view.
  Element.prototype.scrollIntoView = vi.fn();
  getDecisionFormOptions.mockResolvedValue({
    success: true,
    data: {
      requireApproveComment: false,
      reasons: [
        { id: "r-budget", name: "No budget available", description: "Over" },
      ],
      costCenters: [{ id: "cc-1", code: "MKT", name: "Marketing" }],
      canManageCostCenters: false,
      canManageReasons: false,
    },
  });
});

describe("DecisionDialog", () => {
  it("approves with conditions and start date; flags missing cost centre / category", async () => {
    actions.approveRequest.mockResolvedValue({ success: true, data: {} });
    const { onDone, onClose } = renderDialog("approve");
    expect(await screen.findByText("Approve Miro")).toBeInTheDocument();
    // Both the cost centre and the category are missing on this request.
    expect(
      await screen.findAllByText("Missing on the request — assign one now")
    ).toHaveLength(2);
    await userEvent.type(
      screen.getByLabelText("Conditions or notes to the requester"),
      "Annual plan only"
    );
    await userEvent.type(
      screen.getByLabelText("Effective start date"),
      "2026-12-01"
    );
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(actions.approveRequest).toHaveBeenCalledWith("req-1", {
      comment: null,
      conditions: "Annual plan only",
      costCenterId: null,
      categoryId: null,
      effectiveStartDate: "2026-12-01",
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("requires a reason and a comment before rejecting", async () => {
    renderDialog("reject");
    expect(await screen.findByText("Reject Miro")).toBeInTheDocument();
    await screen.findByLabelText(/Rejection reason/);
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(screen.getAllByText("Required")).toHaveLength(2);
    expect(actions.rejectRequest).not.toHaveBeenCalled();
  });

  it("shows server field errors under the inputs", async () => {
    getDecisionFormOptions.mockResolvedValue({
      success: true,
      data: {
        requireApproveComment: true,
        reasons: [],
        costCenters: [],
        canManageCostCenters: false,
        canManageReasons: false,
      },
    });
    actions.approveRequest.mockResolvedValue({
      success: false,
      error: "Please check your input",
      errors: { effectiveStartDate: ["Invalid date"] },
    });
    renderDialog("approve");
    const comment = await screen.findByLabelText(/^Comment/);
    await userEvent.type(comment, "ok");
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(await screen.findByText("Invalid date")).toBeInTheDocument();
    expect(screen.getByText("Please check your input")).toBeInTheDocument();
  });

  it("bulk rejects selected requests with one reason and reports skipped ones", async () => {
    bulkDecideRequests.mockResolvedValue({
      success: true,
      data: {
        succeeded: ["a"],
        failed: [{ id: "b", error: "This request is no longer pending" }],
      },
    });
    const { onDone } = renderDialog("reject", {
      ids: ["a", "b"],
      serviceName: "Miro",
      categoryId: null,
      costCenterId: null,
    });
    expect(await screen.findByText("Reject 2 requests")).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("combobox"));
    await userEvent.click(await screen.findByText("No budget available"));
    await userEvent.type(screen.getByLabelText(/^Comment/), "Not this year");
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(bulkDecideRequests).toHaveBeenCalledWith({
      requestIds: ["a", "b"],
      action: "reject",
      comment: "Not this year",
      reasonId: "r-budget",
    });
  });
});
