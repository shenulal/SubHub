import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/actions/taxonomy/tags", () => ({
  deleteTag: vi.fn().mockResolvedValue({ success: true, message: "deleted" }),
  renameTag: vi.fn().mockResolvedValue({ success: true }),
  setTagColor: vi.fn().mockResolvedValue({ success: true }),
  ensureTags: vi.fn().mockResolvedValue([]),
  mergeTags: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { deleteTag, ensureTags, renameTag } from "@/actions/taxonomy/tags";

import { TagManager } from "./tag-manager";

const tags = [
  { id: "a", name: "Ops", color: "#112233", usageCount: 3 },
  { id: "b", name: "Finance", color: null, usageCount: 0 },
];

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
beforeAll(() => {
  // The chrome-extension test setup defines ResizeObserver as an arrow function; Radix needs a constructor.
  Object.defineProperty(globalThis, "ResizeObserver", {
    value: ResizeObserverStub,
    configurable: true,
    writable: true,
  });
});

beforeEach(() => vi.clearAllMocks());

describe("TagManager", () => {
  it("renders rows and the empty state", () => {
    const { rerender } = render(
      <TagManager tags={tags} canManage={false} canCreate={false} />
    );
    expect(screen.getByText("Ops")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    rerender(<TagManager tags={[]} canManage canCreate />);
    expect(screen.getByText(/No tags yet/)).toBeInTheDocument();
  });
  it("creates, renames and deletes with confirmation", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<TagManager tags={tags} canManage canCreate />);
    fireEvent.change(screen.getByRole("textbox", { name: "Tag name" }), {
      target: { value: "Legal" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(ensureTags).toHaveBeenCalledWith(["Legal"]);
    fireEvent.click(screen.getAllByRole("button", { name: "Rename" })[0]);
    const input = screen.getByDisplayValue("Ops");
    fireEvent.change(input, { target: { value: "Operations" } });
    fireEvent.submit(input.closest("form")!);
    expect(renameTag).toHaveBeenCalledWith("a", "Operations");
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[1]);
    expect(deleteTag).toHaveBeenCalledWith("b");
  });
  it("shows the merge bar once tags are selected", () => {
    render(<TagManager tags={tags} canManage canCreate />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Ops" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Finance" }));
    fireEvent.click(screen.getByRole("button", { name: "Merge" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
