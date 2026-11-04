// src/components/notifications/notification-centre.test.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationCentre } from "./notification-centre";

const page1 = [
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
];

function renderCentre(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetchMock);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <NotificationCentre />
    </QueryClientProvider>
  );
}

function okList(
  data: unknown[],
  nextCursor: string | null,
  unreadCount: number
) {
  return new Response(
    JSON.stringify({ success: true, data, meta: { nextCursor, unreadCount } }),
    {
      status: 200,
    }
  );
}

describe("NotificationCentre", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/read"))
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      if (url.includes("cursor=n1")) {
        return okList(
          [
            {
              ...page1[0],
              id: "n2",
              title: "Older item",
              readAt: "2024-03-01T00:00:00.000Z",
            },
          ],
          null,
          1
        );
      }
      return okList(page1, "n1", 1);
    });
  });

  it("renders items, filters and loads older pages", async () => {
    renderCentre(fetchMock);
    await screen.findByText("Slack renews in 7 days");

    // group filter → types query param
    fireEvent.click(screen.getByRole("button", { name: /승인|Approvals/ }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("types=APPROVAL_REQUESTED"),
        expect.anything()
      )
    );

    // back to all, load more
    fireEvent.click(screen.getAllByRole("button", { pressed: false })[0]);
    const loadMore = await screen.findByRole("button", {
      name: /이전 알림 더 보기|Load older/,
    });
    fireEvent.click(loadMore);
    await screen.findByText("Older item");
  });

  it("marks everything read from the header action", async () => {
    renderCentre(fetchMock);
    await screen.findByText("Slack renews in 7 days");
    fireEvent.click(
      screen.getByRole("button", {
        name: /모두 읽음으로 표시|Mark all as read/,
      })
    );
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/notifications/read"),
        expect.objectContaining({ body: JSON.stringify({ all: true }) })
      )
    );
  });

  it("toggles unread-only", async () => {
    renderCentre(fetchMock);
    await screen.findByText("Slack renews in 7 days");
    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("unreadOnly=true"),
        expect.anything()
      )
    );
  });
});
