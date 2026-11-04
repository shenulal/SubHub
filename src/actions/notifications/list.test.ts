// src/actions/notifications/list.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rbac/service", () => {
  class ForbiddenError extends Error {}
  return {
    requirePermission: vi.fn(),
    isForbiddenError: (e: unknown) => e instanceof ForbiddenError,
    ForbiddenError,
  };
});
vi.mock("@/lib/services/notification/inbox", () => ({
  listNotificationsFor: vi.fn(),
  getUnreadCountFor: vi.fn(),
  markReadFor: vi.fn(),
  markAllReadFor: vi.fn(),
}));

import { ForbiddenError, requirePermission } from "@/lib/rbac/service";
import {
  getUnreadCountFor,
  listNotificationsFor,
  markAllReadFor,
  markReadFor,
} from "@/lib/services/notification/inbox";
import { revalidatePath } from "next/cache";
import {
  getUnreadCount,
  listNotifications,
  markAllRead,
  markRead,
} from "./list";

const ctx = {
  userId: "u1",
  organizationId: "org-1",
  role: "MEMBER",
  permissions: new Set(),
};

describe("notification list actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requirePermission).mockResolvedValue(ctx as never);
  });

  it("lists with validated params", async () => {
    vi.mocked(listNotificationsFor).mockResolvedValue({
      items: [],
      nextCursor: null,
      unreadCount: 0,
    });
    const res = await listNotifications({ limit: 10, unreadOnly: true });
    expect(requirePermission).toHaveBeenCalledWith("notifications:read");
    expect(listNotificationsFor).toHaveBeenCalledWith(
      { organizationId: "org-1", userId: "u1" },
      expect.objectContaining({ limit: 10, unreadOnly: true })
    );
    expect(res.success).toBe(true);
  });

  it("rejects invalid params", async () => {
    const res = await listNotifications({ limit: 10_000 });
    expect(res.success).toBe(false);
    expect(res.error).toBe("Invalid input");
  });

  it("maps forbidden errors", async () => {
    vi.mocked(requirePermission).mockRejectedValue(new ForbiddenError("nope"));
    const res = await getUnreadCount();
    expect(res).toMatchObject({
      success: false,
      error: "You do not have permission to do this",
    });
  });

  it("returns the unread count", async () => {
    vi.mocked(getUnreadCountFor).mockResolvedValue(4);
    expect(await getUnreadCount()).toEqual({ success: true, data: 4 });
  });

  it("marks ids read and revalidates", async () => {
    vi.mocked(markReadFor).mockResolvedValue(2);
    const res = await markRead(["a", "b"]);
    expect(markReadFor).toHaveBeenCalledWith(
      { organizationId: "org-1", userId: "u1" },
      ["a", "b"]
    );
    expect(revalidatePath).toHaveBeenCalledWith("/notifications");
    expect(res).toEqual({ success: true, data: 2 });
  });

  it("rejects an empty id list", async () => {
    const res = await markRead([]);
    expect(res.success).toBe(false);
    expect(markReadFor).not.toHaveBeenCalled();
  });

  it("marks all read", async () => {
    vi.mocked(markAllReadFor).mockResolvedValue(9);
    expect(await markAllRead()).toEqual({ success: true, data: 9 });
  });
});
