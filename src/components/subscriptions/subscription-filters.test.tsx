// src/components/subscriptions/subscription-filters.test.tsx
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SubscriptionFilterOptions } from "@/types/discovery";

import { SubscriptionFilters } from "./subscription-filters";

const options: SubscriptionFilterOptions = {
  categories: [
    {
      id: "p1",
      name: "Productivity",
      parentId: null,
      children: [{ id: "c1", name: "Docs", parentId: "p1" }],
    },
    { id: "p2", name: "Security", parentId: null, children: [] },
  ],
  tags: [
    { id: "t1", name: "critical", color: "#f00" },
    { id: "t2", name: "finance" },
  ],
  owners: [
    { id: "u1", name: "Aisha" },
    { id: "u2", name: "Omar" },
  ],
  teams: [
    { id: "team-1", name: "Engineering" },
    { id: "team-2", name: "Finance" },
  ],
  costCenters: [{ id: "cc1", name: "CC-100" }],
  paymentMethods: [{ id: "pm1", name: "Corporate card" }],
};

function setup(filter = {}) {
  const onFilterChange = vi.fn();
  render(
    <SubscriptionFilters
      filter={filter}
      sort={{ sortBy: "renewalDate", sortOrder: "asc" }}
      options={options}
      onFilterChange={onFilterChange}
      onSortChange={vi.fn()}
      onReset={vi.fn()}
    />
  );
  return { onFilterChange, user: userEvent.setup() };
}

describe("SubscriptionFilters multi-select", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("adds a second category to the selection", async () => {
    const { onFilterChange, user } = setup({ categoryIds: ["p1"] });
    await user.click(screen.getByRole("combobox", { name: "Category" }));
    await user.click(screen.getByRole("option", { name: /Security/ }));
    expect(onFilterChange).toHaveBeenLastCalledWith({
      categoryIds: ["p1", "p2"],
    });
  });

  it("clearing a facet sends undefined (empty = all)", async () => {
    const { onFilterChange, user } = setup({ tagIds: ["t1"] });
    await user.click(screen.getByRole("combobox", { name: "Tags" }));
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(onFilterChange).toHaveBeenLastCalledWith({ tagIds: undefined });
  });

  it("picks several owners and teams in the advanced popover", async () => {
    const { onFilterChange, user } = setup({ ownerIds: ["u1"] });
    await user.click(screen.getByRole("button", { name: /More filters/ }));
    const owner = screen.getByRole("combobox", { name: "Owner" });
    expect(owner).toHaveTextContent("Aisha");
    await user.click(owner);
    await user.click(screen.getByRole("option", { name: /Omar/ }));
    expect(onFilterChange).toHaveBeenLastCalledWith({
      ownerIds: ["u1", "u2"],
    });
  });

  it("shows the active multi-value facets in the advanced badge", () => {
    setup({ ownerIds: ["u1", "u2"], billingCycles: ["MONTHLY", "YEARLY"] });
    const more = screen.getByRole("button", { name: /More filters/ });
    expect(within(more).getByText("2")).toBeInTheDocument();
  });
});
