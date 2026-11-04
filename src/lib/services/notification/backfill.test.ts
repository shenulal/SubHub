// src/lib/services/notification/backfill.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./legacy-alerts", () => ({ computeLegacyAlerts: vi.fn() }));
vi.mock("./center", () => ({
  notify: vi.fn(),
  getOrganizationAdminIds: vi.fn(),
}));

import { backfillComputedAlerts, legacyDedupeKey } from "./backfill";
import { getOrganizationAdminIds, notify } from "./center";
import { computeLegacyAlerts } from "./legacy-alerts";

const day = new Date("2024-03-11T05:00:00Z");

describe("backfillComputedAlerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOrganizationAdminIds).mockResolvedValue(["admin-1"]);
    vi.mocked(computeLegacyAlerts).mockResolvedValue([
      {
        id: "renewal-s1-30",
        type: "renewal",
        title: "D-30 Slack",
        detail: "2024-04-10",
        createdAt: day,
        link: "/apps/a1",
      },
      {
        id: "shadow-x",
        type: "shadowIT",
        title: "Notion",
        detail: "saas",
        createdAt: day,
        link: "/extensions/review-apps",
      },
    ]);
    vi.mocked(notify)
      .mockResolvedValueOnce({
        inAppCreated: 1,
        emailsSent: 0,
        pushSent: 0,
        deferred: 0,
        skipped: 0,
        deduped: 0,
      })
      .mockResolvedValueOnce({
        inAppCreated: 0,
        emailsSent: 0,
        pushSent: 0,
        deferred: 0,
        skipped: 0,
        deduped: 1,
      });
  });

  it("derives stable dedupe keys (renewals repeat daily)", () => {
    expect(
      legacyDedupeKey({
        id: "renewal-s1-30",
        type: "renewal",
        createdAt: day,
      } as never)
    ).toBe("legacy:renewal-s1-30:2024-03-11");
    expect(
      legacyDedupeKey({
        id: "shadow-x",
        type: "shadowIT",
        createdAt: day,
      } as never)
    ).toBe("legacy:shadow-x");
  });

  it("converts legacy alerts into in-app-only notifications for admins", async () => {
    const res = await backfillComputedAlerts("org-1", day);

    expect(notify).toHaveBeenCalledTimes(2);
    expect(vi.mocked(notify).mock.calls[0][0]).toMatchObject({
      organizationId: "org-1",
      userIds: ["admin-1"],
      type: "RENEWAL_REMINDER",
      channels: ["IN_APP"],
      dedupeKey: "legacy:renewal-s1-30:2024-03-11",
      link: "/apps/a1",
    });
    expect(vi.mocked(notify).mock.calls[1][0]).toMatchObject({
      type: "SHADOW_IT",
      title: "Unapproved app detected: Notion",
    });
    expect(res).toEqual({
      organizationId: "org-1",
      legacyAlerts: 2,
      created: 1,
      deduped: 1,
    });
  });

  it("does nothing without admins", async () => {
    vi.mocked(getOrganizationAdminIds).mockResolvedValue([]);
    const res = await backfillComputedAlerts("org-1", day);
    expect(notify).not.toHaveBeenCalled();
    expect(res.created).toBe(0);
  });
});
