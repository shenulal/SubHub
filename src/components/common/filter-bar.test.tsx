// src/components/common/filter-bar.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AdvancedFilterBar } from "./advanced-filter-bar";
import { FilterBar } from "./filter-bar";

Element.prototype.scrollIntoView = vi.fn();

const statusFilter = {
  id: "status",
  label: "Status",
  options: [
    { value: "PENDING", label: "Pending" },
    { value: "APPROVED", label: "Approved" },
  ],
};

describe("FilterBar (multi-select)", () => {
  it("emits the full list of picked values", async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    render(
      <FilterBar
        filters={[statusFilter]}
        filterValues={{ status: ["PENDING"] }}
        onFilterChange={onFilterChange}
      />
    );
    await user.click(screen.getByRole("combobox", { name: "Status" }));
    await user.click(screen.getByRole("option", { name: /Approved/ }));
    expect(onFilterChange).toHaveBeenLastCalledWith("status", [
      "PENDING",
      "APPROVED",
    ]);
  });

  it("counts a facet as active only when something is picked", () => {
    const { rerender } = render(
      <FilterBar filters={[statusFilter]} filterValues={{ status: [] }} />
    );
    expect(screen.queryByText(/filters applied/)).not.toBeInTheDocument();
    rerender(
      <FilterBar
        filters={[statusFilter]}
        filterValues={{ status: ["PENDING", "APPROVED"] }}
      />
    );
    expect(screen.getByText("1 filters applied")).toBeInTheDocument();
  });
});

describe("AdvancedFilterBar facets", () => {
  it("uses the shared MultiSelect and returns a Set of values", async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    render(
      <AdvancedFilterBar
        searchValue=""
        onSearchChange={vi.fn()}
        filters={[
          {
            id: "status",
            title: "Status",
            options: [
              { value: "ACTIVE", label: "Active" },
              { value: "ERROR", label: "Error" },
            ],
          },
        ]}
        selectedFilters={{ status: new Set(["ACTIVE"]) }}
        onFilterChange={onFilterChange}
      />
    );
    const trigger = screen.getByRole("combobox", { name: "Status" });
    expect(trigger).toHaveTextContent("Active");
    await user.click(trigger);
    await user.click(screen.getByRole("option", { name: /Error/ }));
    expect(onFilterChange).toHaveBeenLastCalledWith(
      "status",
      new Set(["ACTIVE", "ERROR"])
    );
  });
});
