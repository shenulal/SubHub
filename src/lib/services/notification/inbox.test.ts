// src/lib/services/notification/inbox.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    notification: { findMany: vi.fn(), count: vi.fn(), updateMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import {
  getUnreadCountFor,
  listNotificationsFor,
  markAllReadFor,
  markReadFor,
  toNotificationItem,
} from "./inbox";

const scope = { organizationId: "org-1", userId: "u1" };

function row(id: string, readAt: Date | null = null) {
  return {
    id,
    organizationId: "org-1",
    userId: "u1",
    type: "RENEWAL_REMINDER",
    title: `t-${id}`,
    body: null,
    link: "/x",
    dedupeKey: null,
    metadata: { a: 1 },
    readAt,
    createdAt: new Date("2024-03-01T00:00:00Z"),
  };
}

describe("inbox service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("serialises rows", () => {
    const item = toNotificationItem(
      row("n1", new Date("2024-03-02T00:00:00Z")) as never
    );
    expect(item).toMatchObject({
      id: "n1",
      readAt: "2024-03-02T00:00:00.000Z",
      createdAt: "2024-03-01T00:00:00.000Z",
      metadata: { a: 1 },
    });
  });

  it("pages with a cursor and reports hasMore via nextCursor", async () => {
    vi.mocked(prisma.notification.findMany).mockResolvedValue([
      row("a"),
      row("b"),
      row("c"),
    ] as never);
    vi.mocked(prisma.notification.count).mockResolvedValue(5);

    const page = await listNotificationsFor(scope, {
      limit: 2,
      unreadOnly: true,
      types: ["RENEWAL_REMINDER"],
    });

    expect(page.items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(page.nextCursor).toBe("b");
    expect(page.unreadCount).toBe(5);
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: "org-1",
          userId: "u1",
          readAt: null,
          type: { in: ["RENEWAL_REMINDER"] },
        },
        take: 3,
      })
    );
  });

  it("passes the cursor and skips it", async () => {
    vi.mocked(prisma.notification.findMany).mockResolvedValue([
      row("c"),
    ] as never);
    vi.mocked(prisma.notification.count).mockResolvedValue(0);

    const page = await listNotificationsFor(scope, { cursor: "b", limit: 2 });

    expect(page.nextCursor).toBeNull();
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: "b" }, skip: 1 })
    );
  });

  it("counts unread within the scope", async () => {
    vi.mocked(prisma.notification.count).mockResolvedValue(3);
    expect(await getUnreadCountFor(scope)).toBe(3);
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: { organizationId: "org-1", userId: "u1", readAt: null },
    });
  });

  it("marks selected ids read only inside the scope", async () => {
    vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 2 });
    const now = new Date("2024-03-05T00:00:00Z");
    expect(await markReadFor(scope, ["a", "b"], now)).toBe(2);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["a", "b"] },
        organizationId: "org-1",
        userId: "u1",
        readAt: null,
      },
      data: { readAt: now },
    });
    expect(await markReadFor(scope, [])).toBe(0);
  });

  it("marks everything read", async () => {
    vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 7 });
    expect(await markAllReadFor(scope)).toBe(7);
  });
});
