// src/components/taxonomy/category-picker.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CategoryNode } from "@/types/taxonomy";

// cmdk scrolls the active item into view; jsdom lacks the API.
Element.prototype.scrollIntoView = vi.fn();

const fresh: CategoryNode[] = [];
vi.mock("@/actions/taxonomy/categories", () => ({
  getCategoryTree: vi.fn(async () => fresh),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { createCategory } from "@/actions/taxonomy/categories";

import { CategoryPicker } from "./category-picker";

const node = (id: string, name: string, parentId: string | null = null) => ({
  id,
  name,
  slug: id,
  parentId,
  icon: null,
  color: null,
  isArchived: false,
  isDefault: false,
  sortOrder: 0,
  budgetMonthly: null,
  children: [] as CategoryNode[],
});

const tree: CategoryNode[] = [node("sw", "Software")];

describe("CategoryPicker inline creation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("hides the create row without categories:manage", async () => {
    const user = userEvent.setup();
    render(
      <CategoryPicker
        tree={tree}
        value={null}
        onChange={vi.fn()}
        canCreate={false}
      />
    );
    await user.click(
      screen.getByRole("combobox", { name: "Select a category" })
    );
    await user.type(screen.getByPlaceholderText("Search…"), "Legal");
    expect(screen.queryByText(/Create “Legal”/)).toBeNull();
  });

  it("creates a category prefilled with the search text and selects it", async () => {
    const created = node("legal", "Legal");
    fresh.splice(0, fresh.length, ...tree, created);
    vi.mocked(createCategory).mockResolvedValue({
      success: true,
      data: { ...created, usageCount: 0 },
    });
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <CategoryPicker tree={tree} value={null} onChange={onChange} canCreate />
    );

    await user.click(
      screen.getByRole("combobox", { name: "Select a category" })
    );
    await user.type(screen.getByPlaceholderText("Search…"), "Legal");
    await user.click(screen.getByText(/Create “Legal”/));

    const nameInput = await screen.findByLabelText("Name");
    expect(nameInput).toHaveValue("Legal");
    await user.click(screen.getByRole("button", { name: /Save/ }));

    await waitFor(() =>
      expect(createCategory).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Legal", parentId: null })
      )
    );
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(
        "legal",
        expect.objectContaining({ name: "Legal" })
      )
    );
  });
});
