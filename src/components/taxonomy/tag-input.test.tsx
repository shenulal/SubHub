import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/actions/taxonomy/tags", () => ({
  searchTags: vi.fn().mockResolvedValue([]),
}));

import { TagInput } from "./tag-input";

const search = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  search.mockResolvedValue([
    { id: "t1", name: "Ops", color: "#123456", usageCount: 2 },
    { id: "t2", name: "Operations", color: null },
  ]);
});

describe("TagInput", () => {
  it("renders chips and removes on click", () => {
    const onChange = vi.fn();
    render(
      <TagInput
        value={["Ops", "Finance"]}
        onChange={onChange}
        search={search}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove Finance" }));
    expect(onChange).toHaveBeenCalledWith(["Ops"]);
  });
  it("suggests existing tags, excludes applied ones and offers create-on-enter", async () => {
    const onChange = vi.fn();
    render(<TagInput value={["Ops"]} onChange={onChange} search={search} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "Op" } });
    await act(async () => {
      vi.advanceTimersByTime(200);
      await Promise.resolve();
    });
    expect(search).toHaveBeenCalledWith("Op", 8);
    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "Operations",
      "Create “Op”",
    ]);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(["Ops", "Op"]);
  });
  it("removes the last chip on backspace when empty and ignores duplicates", () => {
    const onChange = vi.fn();
    render(<TagInput value={["Ops"]} onChange={onChange} search={search} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "ops" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
