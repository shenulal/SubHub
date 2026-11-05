// src/components/subscriptions/subscription-bulk-bar.test.tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SubscriptionBulkBar } from "./subscription-bulk-bar";
import { filterOptions } from "./test-fixtures";

const { exportSubscriptionsCsv, downloadCSV } = vi.hoisted(() => ({
  exportSubscriptionsCsv: vi.fn(),
  downloadCSV: vi.fn(),
}));

vi.mock("../../hooks/use-permissions", () => ({
  usePermissions: () => ({
    can: () => true,
    isLoading: false,
    permissions: new Set(),
  }),
}));
vi.mock("@/actions/discovery/export", () => ({
  exportSubscriptionsCsv: (...a: unknown[]) => exportSubscriptionsCsv(...a),
}));
vi.mock("@/actions/subscriptions/subscription-lifecycle", () => ({
  bulkUpdateSubscriptions: vi.fn(),
}));
vi.mock("@/lib/services/export/csv", () => ({
  downloadCSV: (...a: unknown[]) => downloadCSV(...a),
}));

function renderBar(
  overrides: Partial<React.ComponentProps<typeof SubscriptionBulkBar>> = {}
) {
  const bulkUpdate = vi
    .fn()
    .mockResolvedValue({ success: true, data: { updated: 2 } });
  const onClear = vi.fn();
  const onSelectAllMatching = vi.fn().mockResolvedValue(undefined);
  render(
    <SubscriptionBulkBar
      selectedIds={["a", "b"]}
      matchingTotal={10}
      pageRowCount={2}
      allMatchingSelected={false}
      onSelectAllMatching={onSelectAllMatching}
      onClear={onClear}
      options={filterOptions}
      filter={{}}
      bulkUpdate={bulkUpdate as never}
      {...overrides}
    />
  );
  return { bulkUpdate, onClear, onSelectAllMatching };
}

describe("SubscriptionBulkBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  });

  it("renders nothing without a selection", () => {
    renderBar({ selectedIds: [] });
    expect(
      screen.queryByTestId("subscription-bulk-bar")
    ).not.toBeInTheDocument();
  });

  it("offers select-all when the page is fully selected and more rows match", () => {
    const { onSelectAllMatching } = renderBar();
    fireEvent.click(screen.getByText("Select all 10 matching"));
    expect(onSelectAllMatching).toHaveBeenCalled();
  });

  it("archives the selection and clears it on success", async () => {
    const { bulkUpdate, onClear } = renderBar();
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() =>
      expect(bulkUpdate).toHaveBeenCalledWith(["a", "b"], { archive: true })
    );
    expect(onClear).toHaveBeenCalled();
  });

  it("sets a category through the popover", async () => {
    const { bulkUpdate } = renderBar();
    fireEvent.click(screen.getByRole("button", { name: "Set category" }));
    fireEvent.click(screen.getByText("Productivity › Chat"));
    await waitFor(() =>
      expect(bulkUpdate).toHaveBeenCalledWith(["a", "b"], { categoryId: "c1" })
    );
  });

  it("adds and removes tags in one patch (names for add, ids for remove)", async () => {
    const { bulkUpdate } = renderBar();
    fireEvent.click(screen.getByRole("button", { name: "Add tags" }));
    fireEvent.click(screen.getByText("trial"));
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove tags" }));
    fireEvent.click(screen.getByText("core"));
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply tags" }));
    await waitFor(() =>
      expect(bulkUpdate).toHaveBeenCalledWith(["a", "b"], {
        addTagNames: ["trial"],
        removeTagIds: ["t1"],
      })
    );
  });

  it("exports only the selected ids", async () => {
    exportSubscriptionsCsv.mockResolvedValue({
      success: true,
      data: { csv: "x", filename: "f.csv", rowCount: 2 },
    });
    renderBar();
    fireEvent.click(screen.getByRole("button", { name: "Export selected" }));
    await waitFor(() =>
      expect(exportSubscriptionsCsv).toHaveBeenCalledWith({
        filter: { includeArchived: true },
        ids: ["a", "b"],
      })
    );
    expect(downloadCSV).toHaveBeenCalledWith("x", "f.csv");
  });

  it("surfaces failures without clearing the selection", async () => {
    const { bulkUpdate, onClear } = renderBar();
    bulkUpdate.mockResolvedValue({ success: false, error: "nope" });
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() => expect(bulkUpdate).toHaveBeenCalled());
    expect(onClear).not.toHaveBeenCalled();
  });
});
