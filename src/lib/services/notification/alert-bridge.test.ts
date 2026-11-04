// src/lib/services/notification/alert-bridge.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./center", () => ({ notify: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { user: { findFirst: vi.fn() } } }));

import { prisma } from "@/lib/db";
import { mirrorAlertInApp } from "./alert-bridge";
import { notify } from "./center";

describe("mirrorAlertInApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(notify).mockResolvedValue({
      inAppCreated: 1,
      emailsSent: 0,
      pushSent: 0,
      deferred: 0,
      skipped: 0,
      deduped: 0,
    });
  });

  it("skips when no organisation is provided (legacy callers)", async () => {
    expect(await mirrorAlertInApp({ type: "SHADOW_IT", title: "x" })).toBe(0);
    expect(notify).not.toHaveBeenCalled();
  });

  it("creates an in-app-only notification for a known user id", async () => {
    const n = await mirrorAlertInApp({
      organizationId: "org-1",
      recipientUserId: "u1",
      type: "COST_ANOMALY",
      title: "Slack +60%",
      link: "/cost",
      dedupeKey: "cost:slack",
    });
    expect(n).toBe(1);
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        userIds: ["u1"],
        channels: ["IN_APP"],
        dedupeKey: "cost:slack",
      })
    );
  });

  it("resolves the recipient by email inside the organisation", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "u9" } as never);
    await mirrorAlertInApp({
      organizationId: "org-1",
      recipientEmail: "a@b.c",
      type: "OFFBOARDING",
      title: "t",
    });
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "a@b.c", organizationId: "org-1" },
      })
    );
    expect(vi.mocked(notify).mock.calls[0][0].userIds).toEqual(["u9"]);
  });

  it("never throws", async () => {
    vi.mocked(notify).mockRejectedValue(new Error("db"));
    expect(
      await mirrorAlertInApp({
        organizationId: "o",
        recipientUserId: "u",
        type: "SYSTEM",
        title: "t",
      })
    ).toBe(0);
  });
});
