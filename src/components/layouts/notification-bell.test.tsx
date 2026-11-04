// src/components/layouts/notification-bell.test.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationBell } from "./notification-bell";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

const items = [
  {
    id: "n1",
    type: "RENEWAL_REMINDER",
    title: "Slack renews in 7 days",
    body: "AED 120",
    link: "/subscriptions/s1",
    readAt: null,
    createdAt: "2024-03-11T05:00:00.000Z",
    metadata: null,
  },
  {
    id: "n2",
    type: "APPROVAL_DECIDED",
    title: "Notion approved",
    body: null,
    link: "/approvals/r1",
    readAt: "2024-03-10T05:00:00.000Z",
    createdAt: "2024-03-10T05:00:00.000Z",
    metadata: null,
  },
];

function mockFetch() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/unread-count")) {
      return new Response(
        JSON.stringify({ success: true, data: { count: 3 } }),
        { status: 200 }
      );
    }
    if (url.includes("/read")) {
      return new Response(
        JSON.stringify({ success: true, data: { updated: 1 } }),
        { status: 200 }
      );
    }
    void init;
    return new Response(
      JSON.stringify({
        success: true,
        data: items,
        meta: { nextCursor: null, unreadCount: 3 },
      }),
      { status: 200 }
    );
  });
}

function renderBell() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <NotificationBell />
    </QueryClientProvider>
  );
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

async function openMenu() {
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  await user.click(await screen.findByRole("button", { name: /3/ }));
}

describe("NotificationBell", () => {
  let fetchMock: ReturnType<typeof mockFetch>;
  beforeAll(() => {
    // vitest.setup mocks ResizeObserver with vi.fn(), which Radix popper cannot `new`
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  });
  beforeEach(() => {
    fetchMock = mockFetch();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("shows the unread badge from the polled count", async () => {
    renderBell();
    await waitFor(() =>
      expect(screen.getByTestId("unread-badge")).toHaveTextContent("3")
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/notifications/unread-count"),
      expect.anything()
    );
  });

  it("lists recent notifications and marks one read on click", async () => {
    renderBell();
    await waitFor(() => screen.getByTestId("unread-badge"));
    await openMenu();

    const row = await screen.findByText("Slack renews in 7 days");
    expect(screen.getByText("Notion approved")).toBeInTheDocument();
    fireEvent.click(row);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/notifications/read"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ ids: ["n1"] }),
        })
      )
    );
  });

  it("offers a link to the full centre", async () => {
    renderBell();
    await waitFor(() => screen.getByTestId("unread-badge"));
    await openMenu();
    const link = await screen.findByRole("link");
    expect(link).toHaveAttribute("href", "/notifications");
  });
});
