// src/components/subscriptions/subscription-form-vendor-list.test.tsx
import { Command } from "@/components/ui/command";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { filterOwnApps, VendorList } from "./subscription-form-vendor-list";

Element.prototype.scrollIntoView = vi.fn();
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const apps = [
  { id: "a1", name: "Slack" },
  { id: "a2", name: "Notion" },
];

function renderList(overrides: Partial<Parameters<typeof VendorList>[0]> = {}) {
  const props = {
    listId: "list",
    query: "Fig",
    apps,
    results: [],
    isSearching: false,
    selectedAppId: "",
    selectedCatalogId: "",
    canCreateApp: true,
    onPickApp: vi.fn(),
    onPickCatalog: vi.fn(),
    onUseName: vi.fn(),
    onCreateApp: vi.fn(),
    ...overrides,
  };
  render(
    <Command shouldFilter={false}>
      <VendorList {...props} />
    </Command>
  );
  return props;
}

describe("VendorList", () => {
  it("offers '+ Create app' with the typed text to app managers", async () => {
    const props = renderList();
    await userEvent.click(screen.getByText("Create app “Fig”"));
    expect(props.onCreateApp).toHaveBeenCalledWith("Fig");
    expect(screen.queryByText(/Use "Fig"/)).not.toBeInTheDocument();
  });

  it("falls back to the free-text vendor for users without apps:manage", async () => {
    const props = renderList({ canCreateApp: false });
    expect(screen.queryByText("Create app “Fig”")).not.toBeInTheDocument();
    await userEvent.click(screen.getByText('Use "Fig"'));
    expect(props.onUseName).toHaveBeenCalledWith("Fig");
  });

  it("lists the organisation's apps and selects one", async () => {
    const props = renderList({ query: "sl" });
    expect(screen.getByText("Your apps")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Slack"));
    expect(props.onPickApp).toHaveBeenCalledWith({ id: "a1", name: "Slack" });
  });

  it("hides the create row when the name already exists", () => {
    renderList({ query: "notion" });
    expect(screen.queryByText(/Create app/)).not.toBeInTheDocument();
  });
});

describe("filterOwnApps", () => {
  it("matches case-insensitively and caps the list", () => {
    expect(filterOwnApps(apps, "NOT")).toEqual([{ id: "a2", name: "Notion" }]);
    const many = Array.from({ length: 20 }, (_, i) => ({
      id: `${i}`,
      name: `App ${i}`,
    }));
    expect(filterOwnApps(many, "")).toHaveLength(8);
  });
});
