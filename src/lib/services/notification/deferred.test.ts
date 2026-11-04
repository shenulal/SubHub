// src/lib/services/notification/deferred.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    notification: { findMany: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));
vi.mock("./center-email", () => ({ sendNotifyEmails: vi.fn() }));
vi.mock("./center-push", () => ({ sendNotifyPush: vi.fn() }));

import { prisma } from "@/lib/db";
import { sendNotifyEmails } from "./center-email";
import { sendNotifyPush } from "./center-push";
import { processDeferredNotifications } from "./deferred";

describe("processDeferredNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      email: "a@example.com",
      status: "ACTIVE",
    } as never);
    vi.mocked(sendNotifyEmails).mockResolvedValue(1);
    vi.mocked(sendNotifyPush).mockResolvedValue(1);
    vi.mocked(prisma.notification.update).mockResolvedValue({} as never);
  });

  it("releases due rows, sends payloads and strips deferral metadata", async () => {
    const now = new Date("2024-03-11T06:00:00Z");
    vi.mocked(prisma.notification.findMany).mockResolvedValue([
      {
        id: "n1",
        organizationId: "org-1",
        userId: "u1",
        type: "RENEWAL_REMINDER",
        metadata: {
          subscriptionId: "s1",
          deferredUntil: now.getTime() - 1000,
          deferredEmail: { subject: "S", html: "<p>h</p>" },
          deferredPush: { title: "S" },
        },
      },
    ] as never);

    const res = await processDeferredNotifications(now);

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { metadata: { path: ["deferredUntil"], lte: now.getTime() } },
      })
    );
    expect(sendNotifyEmails).toHaveBeenCalledWith(
      "org-1",
      [{ email: "a@example.com", content: { subject: "S", html: "<p>h</p>" } }],
      "RENEWAL_REMINDER"
    );
    expect(sendNotifyPush).toHaveBeenCalledWith(
      ["u1"],
      { title: "S" },
      "RENEWAL_REMINDER"
    );
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: "n1" },
      data: { metadata: { subscriptionId: "s1" } },
    });
    expect(res).toEqual({ processed: 1, emailsSent: 1, pushSent: 1 });
  });

  it("keeps going when a row fails", async () => {
    vi.mocked(prisma.notification.findMany).mockResolvedValue([
      {
        id: "n1",
        organizationId: "o",
        userId: "u",
        type: "SYSTEM",
        metadata: { deferredUntil: 1, deferredPush: { title: "x" } },
      },
      {
        id: "n2",
        organizationId: "o",
        userId: "u",
        type: "SYSTEM",
        metadata: { deferredUntil: 1 },
      },
    ] as never);
    vi.mocked(sendNotifyPush).mockRejectedValueOnce(new Error("push down"));

    const res = await processDeferredNotifications(new Date());

    expect(res.processed).toBe(1);
    expect(prisma.notification.update).toHaveBeenCalledTimes(1);
  });
});
