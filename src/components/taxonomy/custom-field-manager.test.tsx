import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { CustomFieldDefinitionDto } from "@/types/taxonomy";

vi.mock("@/actions/taxonomy/custom-fields", () => ({
  archiveCustomField: vi.fn().mockResolvedValue({ success: true }),
  restoreCustomField: vi.fn().mockResolvedValue({ success: true }),
  reorderCustomFields: vi.fn().mockResolvedValue({ success: true }),
  createCustomField: vi.fn(),
  updateCustomField: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import {
  archiveCustomField,
  reorderCustomFields,
} from "@/actions/taxonomy/custom-fields";

import { CustomFieldManager } from "./custom-field-manager";

const fields: CustomFieldDefinitionDto[] = [
  {
    id: "a",
    key: "owner",
    label: "Owner",
    fieldType: "TEXT",
    options: null,
    isRequired: true,
    sortOrder: 0,
    usageCount: 2,
  },
  {
    id: "b",
    key: "tier",
    label: "Tier",
    fieldType: "SELECT",
    options: ["Gold"],
    isRequired: false,
    sortOrder: 1,
  },
  {
    id: "c",
    key: "old",
    label: "Old",
    fieldType: "DATE",
    options: null,
    isRequired: false,
    sortOrder: 2,
    isArchived: true,
  },
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

describe("CustomFieldManager", () => {
  it("shows the usage against the limit and disables add when reached", () => {
    render(<CustomFieldManager fields={fields} maxFields={2} canManage />);
    expect(screen.getByText(/reached the limit of 2/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add field" })).toBeDisabled();
    expect(screen.queryByText("Old")).not.toBeInTheDocument();
    expect(screen.getByText("Required")).toBeInTheDocument();
  });
  it("archives and reorders active fields", async () => {
    render(<CustomFieldManager fields={fields} maxFields={5} canManage />);
    expect(screen.getByText("2 of 5 fields in use")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Move down" })[0]);
    expect(reorderCustomFields).toHaveBeenCalledWith(["b", "a"]);
    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: "Archive" })[0]
      ).toBeEnabled()
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Archive" })[0]);
    expect(archiveCustomField).toHaveBeenCalledWith("a");
  });
  it("opens the create dialog with type options", () => {
    render(<CustomFieldManager fields={[]} maxFields={3} canManage />);
    expect(screen.getByText("No custom fields defined.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    expect(
      screen.getByRole("heading", { name: "New custom field" })
    ).toBeInTheDocument();
  });
});
