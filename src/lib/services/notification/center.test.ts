// src/lib/services/notification/center.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    notificationPreference: { findMany: vi.fn() },
    notification: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    user: { findMany: vi.fn() },
    organization: { findUnique: vi.fn() },
    deviceToken: { findMany: vi.fn(), deleteMany: vi.fn() },
  },
}));
vi.mock("@/lib/settings/service", () => ({ getSettings: vi.fn() }));
vi.mock("./adapters/templates", () => ({
  loadTemplates: vi.fn(),
  renderLoadedTemplate: vi.fn(
    (
      t: { subject: string | null; body: string },
      vars: Record<string, unknown>
    ) => ({
      subject: (t.subject ?? "").replace(
        "{{recipientName}}",
        String(vars.recipientName)
      ),
      body: t.body.replace("{{recipientName}}", String(vars.recipientName)),
    })
  ),
  textToHtml: vi.fn((s: string) => `<p>${s}</p>`),
}));
vi.mock("./center-email", () => ({ sendNotifyEmails: vi.fn() }));
vi.mock("./center-push", () => ({ sendNotifyPush: vi.fn() }));
vi.mock("./retention", () => ({
  trimInboxes: vi.fn().mockResolvedValue({ deleted: 0 }),
}));

import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings/service";
import { loadTemplates } from "./adapters/templates";
import { notify } from "./center";
import { sendNotifyEmails } from "./center-email";
import { sendNotifyPush } from "./center-push";
import { trimInboxes } from "./retention";

const baseSettings = {
  "notifications.enabledChannels": ["IN_APP", "EMAIL", "PUSH"],
  "notifications.quietHoursStart": null,
  "notifications.quietHoursEnd": null,
  "notifications.maxInAppItems": 200,
  "privacy.notificationRetentionDays": 90,
  "general.timezone": "Asia/Dubai",
};

type CreatedRow = {
  userId: string;
  title: string;
  body: string | null;
  dedupeKey: string | null;
  metadata?: {
    deferredUntil?: number;
    deferredEmail?: unknown;
    deferredPush?: unknown;
  };
};

/** Rows passed to the (mocked) createMany in the first call. */
function createdRows(): CreatedRow[] {
  const call = vi.mocked(prisma.notification.createMany).mock.calls[0]?.[0];
  if (!call) throw new Error("createMany was not called");
  return call.data as unknown as CreatedRow[];
}

function emailedRecipients() {
  const call = vi.mocked(sendNotifyEmails).mock.calls[0];
  if (!call) throw new Error("sendNotifyEmails was not called");
  return call[1];
}

type SettingsOverrides = Partial<Record<keyof typeof baseSettings, unknown>>;

const users = [
  { id: "u1", name: "Aisha", email: "aisha@example.com" },
  { id: "u2", name: null, email: "omar@example.com" },
];

function arrange(overrides: SettingsOverrides = {}) {
  vi.mocked(getSettings).mockResolvedValue({
    ...baseSettings,
    ...overrides,
  } as never);
  vi.mocked(prisma.notificationPreference.findMany).mockResolvedValue([]);
  vi.mocked(prisma.notification.findMany).mockResolvedValue([]);
  vi.mocked(prisma.notification.createMany).mockResolvedValue({ count: 2 });
  vi.mocked(prisma.user.findMany).mockResolvedValue(users as never);
  vi.mocked(prisma.organization.findUnique).mockResolvedValue({
    name: "Acme",
  } as never);
  vi.mocked(sendNotifyEmails).mockResolvedValue(2);
  vi.mocked(sendNotifyPush).mockResolvedValue(1);
}

const input = {
  organizationId: "org-1",
  userIds: ["u1", "u2", "u1"],
  type: "RENEWAL_REMINDER" as const,
  title: "Slack renews in 7 days",
  body: "Renews 2024-03-18",
  link: "/subscriptions/s1",
  dedupeKey: "renewal:s1:2024-03-18:7",
  email: { subject: "Slack renews", html: "<b>hi</b>" },
  now: new Date("2024-03-11T05:00:00Z"),
};

describe("notify()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    arrange();
  });

  it("returns zeros without recipients", async () => {
    const res = await notify({ ...input, userIds: [] });
    expect(res.inAppCreated).toBe(0);
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it("creates deduped in-app rows, sends email + push and trims inboxes", async () => {
    const res = await notify(input);

    const call = vi.mocked(prisma.notification.createMany).mock.calls[0]?.[0];
    expect(call?.skipDuplicates).toBe(true);
    expect(createdRows()).toHaveLength(2);
    expect(createdRows()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: "u1",
          dedupeKey: input.dedupeKey,
          title: input.title,
        }),
      ])
    );
    expect(sendNotifyEmails).toHaveBeenCalledWith(
      "org-1",
      expect.arrayContaining([
        expect.objectContaining({
          email: "aisha@example.com",
          content: input.email,
        }),
      ]),
      "RENEWAL_REMINDER"
    );
    expect(sendNotifyPush).toHaveBeenCalledWith(
      ["u1", "u2"],
      expect.objectContaining({ title: input.title }),
      "RENEWAL_REMINDER"
    );
    expect(trimInboxes).toHaveBeenCalledWith(
      "org-1",
      ["u1", "u2"],
      expect.objectContaining({ maxItems: 200, retentionDays: 90 })
    );
    expect(res).toMatchObject({
      inAppCreated: 2,
      emailsSent: 2,
      pushSent: 1,
      deferred: 0,
      deduped: 0,
    });
  });

  it("respects per-user channel preferences", async () => {
    vi.mocked(prisma.notificationPreference.findMany).mockResolvedValue([
      { userId: "u1", channel: "EMAIL", enabled: false },
      { userId: "u2", channel: "IN_APP", enabled: false },
    ] as never);

    const res = await notify(input);

    expect(createdRows()).toHaveLength(1);
    expect(createdRows()[0]?.userId).toBe("u1");
    expect(emailedRecipients()).toEqual([
      expect.objectContaining({ email: "omar@example.com" }),
    ]);
    expect(res.skipped).toBe(2);
  });

  it("skips channels the organisation disabled", async () => {
    arrange({ "notifications.enabledChannels": ["IN_APP"] });
    const res = await notify(input);
    expect(sendNotifyEmails).not.toHaveBeenCalled();
    expect(sendNotifyPush).not.toHaveBeenCalled();
    expect(res.inAppCreated).toBe(2);
  });

  it("excludes recipients already notified for the dedupe key", async () => {
    vi.mocked(prisma.notification.findMany).mockResolvedValue([
      { userId: "u1" },
    ] as never);
    vi.mocked(prisma.notification.createMany).mockResolvedValue({ count: 1 });

    const res = await notify(input);

    expect(createdRows()).toHaveLength(1);
    expect(res.deduped).toBe(1);
  });

  it("returns early when everyone was already notified", async () => {
    vi.mocked(prisma.notification.findMany).mockResolvedValue([
      { userId: "u1" },
      { userId: "u2" },
    ] as never);
    const res = await notify(input);
    expect(res).toMatchObject({ inAppCreated: 0, deduped: 2 });
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it("defers email/push during quiet hours by storing the payload on the row", async () => {
    // 09:00 Dubai (05:00Z) inside 22:00→10:00 quiet window → release at 10:00 Dubai = 06:00Z
    arrange({
      "notifications.quietHoursStart": "22:00",
      "notifications.quietHoursEnd": "10:00",
    });

    const res = await notify(input);

    expect(sendNotifyEmails).not.toHaveBeenCalled();
    expect(sendNotifyPush).not.toHaveBeenCalled();
    const row = createdRows()[0];
    expect(new Date(row?.metadata?.deferredUntil ?? 0).toISOString()).toBe(
      "2024-03-11T06:00:00.000Z"
    );
    expect(row?.metadata?.deferredEmail).toEqual(input.email);
    expect(row?.metadata?.deferredPush).toMatchObject({ title: input.title });
    expect(res.deferred).toBe(4);
  });

  it("bypasses quiet hours when asked", async () => {
    arrange({
      "notifications.quietHoursStart": "22:00",
      "notifications.quietHoursEnd": "10:00",
    });
    const res = await notify({ ...input, bypassQuietHours: true });
    expect(sendNotifyEmails).toHaveBeenCalled();
    expect(res.deferred).toBe(0);
  });

  it("renders organisation templates per recipient and keeps rich literal email for default templates", async () => {
    vi.mocked(loadTemplates).mockResolvedValue({
      IN_APP: {
        subject: "Hi {{recipientName}}",
        body: "Body for {{recipientName}}",
        source: "default",
      },
      EMAIL: {
        subject: "Mail {{recipientName}}",
        body: "Text",
        source: "default",
      },
      PUSH: { subject: "Push", body: "P {{recipientName}}", source: "default" },
    });

    await notify({ ...input, templateVars: { serviceName: "Slack" } });

    const rows = createdRows();
    expect(rows.find((r) => r.userId === "u1")).toMatchObject({
      title: "Hi Aisha",
      body: "Body for Aisha",
    });
    expect(rows.find((r) => r.userId === "u2")).toMatchObject({
      title: "Hi omar@example.com",
    });
    // default EMAIL template does not replace the caller's rich HTML
    expect(emailedRecipients()[0]?.content).toEqual(input.email);
  });

  it("uses a custom EMAIL template over the literal email", async () => {
    vi.mocked(loadTemplates).mockResolvedValue({
      EMAIL: {
        subject: "Custom {{recipientName}}",
        body: "Custom body",
        source: "custom",
      },
    });

    await notify({ ...input, templateVars: { serviceName: "Slack" } });

    expect(emailedRecipients()[0]?.content).toMatchObject({
      subject: "Custom Aisha",
      html: "<p>Custom body</p>",
    });
  });

  it("throws when neither title nor template is available", async () => {
    await expect(notify({ ...input, title: undefined })).rejects.toThrow(
      /title/
    );
  });

  it("restricts delivery to requested channels", async () => {
    await notify({ ...input, channels: ["IN_APP"] });
    expect(sendNotifyEmails).not.toHaveBeenCalled();
    expect(sendNotifyPush).not.toHaveBeenCalled();
  });
});
