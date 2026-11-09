import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CategoryNode } from "@/types/taxonomy";

vi.mock("@/actions/taxonomy/categories", () => ({
  archiveCategory: vi
    .fn()
    .mockResolvedValue({ success: true, message: "archived" }),
  restoreCategory: vi.fn().mockResolvedValue({ success: true }),
  reorderCategories: vi.fn().mockResolvedValue({ success: true }),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import {
  archiveCategory,
  reorderCategories,
} from "@/actions/taxonomy/categories";

import { CategoryTreeEditor } from "./category-tree-editor";

const node = (
  over: Partial<CategoryNode> & { id: string; name: string }
): CategoryNode => ({
  slug: over.id,
  parentId: null,
  icon: null,
  color: null,
  isArchived: false,
  isDefault: false,
  sortOrder: 0,
  budgetMonthly: null,
  children: [],
  ...over,
});
const tree: CategoryNode[] = [
  node({
    id: "sw",
    name: "Software",
    isDefault: true,
    usageCount: 4,
    budgetMonthly: 1200,
    children: [
      node({ id: "design", name: "Design", parentId: "sw", usageCount: 1 }),
      node({ id: "old", name: "Old", parentId: "sw", isArchived: true }),
    ],
  }),
  node({ id: "infra", name: "Infrastructure", sortOrder: 1, usageCount: 0 }),
];

beforeEach(() => vi.clearAllMocks());

describe("CategoryTreeEditor", () => {
  it("renders parents, children, badges and hides archived rows by default", () => {
    render(<CategoryTreeEditor tree={tree} canManage={false} />);
    expect(screen.getByText("Software")).toBeInTheDocument();
    expect(screen.getByText("Design")).toBeInTheDocument();
    expect(screen.queryByText("Old")).not.toBeInTheDocument();
    expect(screen.getByText("Default")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Archive" })
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch"));
    expect(screen.getByText("Old")).toBeInTheDocument();
  });
  it("archives after confirmation and reorders siblings", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<CategoryTreeEditor tree={tree} canManage />);
    expect(
      screen.getAllByRole("button", { name: "Move up" })[0]
    ).toBeDisabled();
    fireEvent.click(screen.getAllByRole("button", { name: "Move down" })[0]);
    expect(reorderCategories).toHaveBeenCalledWith({
      parentId: null,
      orderedIds: ["infra", "sw"],
    });
    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: "Archive" })[0]
      ).toBeEnabled()
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Archive" })[0]);
    expect(archiveCategory).toHaveBeenCalledWith("sw");
  });
  it("opens the create dialog from the toolbar", () => {
    render(<CategoryTreeEditor tree={tree} canManage />);
    fireEvent.click(screen.getByRole("button", { name: "Add category" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "New category" })
    ).toBeInTheDocument();
  });
  it("switches to a flat list with the parent of each category", () => {
    render(<CategoryTreeEditor tree={tree} canManage />);
    fireEvent.click(screen.getByRole("radio", { name: "List" }));
    const table = screen.getByRole("table");
    expect(table).toHaveTextContent("Software");
    expect(table).toHaveTextContent("Infrastructure");
    const design = screen.getByRole("row", { name: /Design/ });
    expect(design).toHaveTextContent("Software");
    expect(
      screen.getByRole("row", { name: /Infrastructure/ })
    ).toHaveTextContent("Top level");
    expect(screen.queryByText("Old")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 3 of 3")).toBeInTheDocument();
  });
  it("archives from the list view after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<CategoryTreeEditor tree={tree} canManage />);
    fireEvent.click(screen.getByRole("radio", { name: "List" }));
    fireEvent.click(screen.getByRole("button", { name: "Archive Design" }));
    await waitFor(() => expect(archiveCategory).toHaveBeenCalledWith("design"));
  });
  it("searches in both views and keeps the full sibling order for reordering", () => {
    render(<CategoryTreeEditor tree={tree} canManage />);
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "infra" },
    });
    expect(screen.getByText("Infrastructure")).toBeInTheDocument();
    expect(screen.queryByText("Software")).not.toBeInTheDocument();
    // Moving the only visible parent up still sends the complete order.
    fireEvent.click(screen.getByRole("button", { name: "Move up" }));
    expect(reorderCategories).toHaveBeenCalledWith({
      parentId: null,
      orderedIds: ["infra", "sw"],
    });
    fireEvent.click(screen.getByRole("radio", { name: "List" }));
    expect(screen.getByText("Showing 1 of 3")).toBeInTheDocument();
  });
});
