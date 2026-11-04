// src/lib/services/notification/retention.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: { notification: { deleteMany: vi.fn(), findMany: vi.fn() } },
}));

import { prisma } from "@/lib/db";
import { trimInboxes } from "./retention";

describe("trimInboxes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes aged rows and overflow beyond maxItems per user", async () => {
    const now = new Date("2024-03-11T00:00:00Z");
    vi.mocked(prisma.notification.deleteMany)
      .mockResolvedValueOnce({ count: 3 })
      .mockResolvedValueOnce({ count: 2 });
    vi.mocked(prisma.notification.findMany)
      .mockResolvedValueOnce([{ id: "x" }, { id: "y" }] as never)
      .mockResolvedValueOnce([]);

    const res = await trimInboxes("org-1", ["u1", "u2"], {
      maxItems: 200,
      retentionDays: 90,
      now,
    });

    expect(prisma.notification.deleteMany).toHaveBeenNthCalledWith(1, {
      where: {
        organizationId: "org-1",
        userId: { in: ["u1", "u2"] },
        createdAt: { lt: new Date("2023-12-12T00:00:00Z") },
      },
    });
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-1", userId: "u1" },
        skip: 200,
      })
    );
    expect(prisma.notification.deleteMany).toHaveBeenNthCalledWith(2, {
      where: { id: { in: ["x", "y"] } },
    });
    expect(res).toEqual({ deleted: 5 });
  });

  it("no-ops without users", async () => {
    expect(
      await trimInboxes("org-1", [], { maxItems: 1, retentionDays: 1 })
    ).toEqual({ deleted: 0 });
    expect(prisma.notification.deleteMany).not.toHaveBeenCalled();
  });
});
