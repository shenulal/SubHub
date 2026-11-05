// src/components/common/command-search.test.tsx
import type { GlobalSearchResult } from "@/types/discovery";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithPermissions } from "@/test/permission-wrapper";

import {
  CommandSearch,
  pushRecentSearch,
  readRecentSearches,
} from "./command-search";
import { QuickCreateContext } from "./quick-create/quick-create-context";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/actions/discovery/search", () => ({ globalSearch: vi.fn() }));

const result: GlobalSearchResult = {
  query: "sl",
  groups: [
    {
      key: "subscriptions",
      items: [
        {
          id: "s1",
          group: "subscriptions",
          title: "Slack",
          subtitle: "Chat",
          href: "/subscriptions/s1",
        },
      ],
    },
    {
      key: "pages",
      items: [
        {
          id: "page-pipeline",
          group: "pages",
          title: "Renewal pipeline",
          labelKey: "pipeline",
          href: "/subscriptions/pipeline",
        },
      ],
    },
  ],
  meta: { limit: 8, minChars: 2, recentSearchesLimit: 3 },
};

describe("CommandSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    // cmdk relies on scrollIntoView / ResizeObserver which jsdom lacks.
    Element.prototype.scrollIntoView = vi.fn();
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  });

  it("opens with Cmd+K, searches with debounce and renders grouped results", async () => {
    const search = vi.fn().mockResolvedValue({ success: true, data: result });
    render(<CommandSearch search={search} />);
    act(() => {
      fireEvent.keyDown(document, { key: "k", metaKey: true });
    });
    const input = await screen.findByPlaceholderText(
      "Search subscriptions, vendors, people, pages…"
    );
    fireEvent.change(input, { target: { value: "sl" } });
    await waitFor(() => expect(search).toHaveBeenCalledWith("sl"));
    expect(await screen.findByText("Slack")).toBeInTheDocument();
    expect(screen.getByText("Subscriptions")).toBeInTheDocument();
    expect(screen.getByText("Renewal pipeline")).toBeInTheDocument();
  });

  it("navigates on select and stores the query as a recent search", async () => {
    const search = vi.fn().mockResolvedValue({ success: true, data: result });
    render(<CommandSearch search={search} />);
    fireEvent.click(screen.getByRole("button", { name: "Open search" }));
    const input = await screen.findByPlaceholderText(
      "Search subscriptions, vendors, people, pages…"
    );
    fireEvent.change(input, { target: { value: "sl" } });
    const item = await screen.findByText("Slack");
    fireEvent.click(item);
    expect(push).toHaveBeenCalledWith("/subscriptions/s1");
    expect(readRecentSearches()).toEqual(["sl"]);
  });

  it("shows recent searches when the query is empty", async () => {
    pushRecentSearch("notion", 5);
    const search = vi
      .fn()
      .mockResolvedValue({ success: true, data: { ...result, groups: [] } });
    render(<CommandSearch search={search} />);
    fireEvent.click(screen.getByRole("button", { name: "Open search" }));
    expect(await screen.findByText("notion")).toBeInTheDocument();
    expect(screen.getByText("Recent searches")).toBeInTheDocument();
  });
});

describe("CommandSearch create actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  });

  const empty = { success: true, data: { ...result, groups: [] } };

  it("offers permitted create actions and opens the dialog in place", async () => {
    const open = vi.fn();
    renderWithPermissions(
      <QuickCreateContext.Provider value={{ open }}>
        <CommandSearch search={vi.fn().mockResolvedValue(empty)} />
      </QuickCreateContext.Provider>,
      ["apps:manage", "teams:manage"]
    );
    fireEvent.click(screen.getByRole("button", { name: "Open search" }));
    const input = await screen.findByPlaceholderText(
      "Search subscriptions, vendors, people, pages…"
    );
    fireEvent.change(input, { target: { value: "team" } });
    const team = await screen.findByText("Team");
    expect(screen.getByText("Create new")).toBeInTheDocument();
    expect(screen.queryByText("Invite member")).not.toBeInTheDocument();
    fireEvent.click(team);
    expect(open).toHaveBeenCalledWith("team");
  });

  it("navigates to the full page when no dialog host is mounted", async () => {
    renderWithPermissions(
      <CommandSearch search={vi.fn().mockResolvedValue(empty)} />,
      ["subscriptions:create"]
    );
    fireEvent.click(screen.getByRole("button", { name: "Open search" }));
    fireEvent.click(await screen.findByText("Subscription"));
    expect(push).toHaveBeenCalledWith("/subscriptions/new");
  });
});

describe("recent searches storage", () => {
  beforeEach(() => window.localStorage.clear());

  it("dedupes, prepends and caps", () => {
    pushRecentSearch("a", 2);
    pushRecentSearch("b", 2);
    expect(pushRecentSearch("a", 2)).toEqual(["a", "b"]);
    expect(pushRecentSearch("c", 2)).toEqual(["c", "a"]);
  });

  it("survives corrupt storage", () => {
    window.localStorage.setItem("subhub.recentSearches", "{not json");
    expect(readRecentSearches()).toEqual([]);
  });
});
