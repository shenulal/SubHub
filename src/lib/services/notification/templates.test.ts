import { prisma } from "@/lib/db";
import type { NotificationEventType } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_TEMPLATES,
  NOTIFICATION_CHANNELS,
  TEMPLATE_PLACEHOLDERS,
} from "./default-templates";
import {
  extractPlaceholders,
  getTemplate,
  renderString,
  renderTemplate,
} from "./templates";

vi.mock("@/lib/db", () => ({
  prisma: { notificationTemplate: { findMany: vi.fn() } },
}));

const findMany = prisma.notificationTemplate.findMany as unknown as ReturnType<
  typeof vi.fn
>;

describe("renderTemplate", () => {
  it("replaces placeholders, tolerating whitespace and dotted paths", () => {
    const out = renderString(
      "Hi {{ name }}, {{sub.serviceName}} renews {{when}}",
      {
        name: "Sara",
        sub: { serviceName: "Figma" },
        when: new Date("2026-12-01T00:00:00Z"),
      }
    );
    expect(out).toBe("Hi Sara, Figma renews 2026-12-01");
  });

  it("renders unknown or null variables as empty strings and tidies spacing", () => {
    const out = renderTemplate(
      { subject: "{{missing}} Hello", body: "A {{nothing}}  B {{list}}" },
      { nothing: null, list: ["x", "y"] }
    );
    expect(out).toEqual({ subject: "Hello", body: "A B x, y" });
  });

  it("lists placeholders used by a template", () => {
    expect(
      extractPlaceholders({ subject: "{{a}}", body: "{{b}} {{ a }}" }).sort()
    ).toEqual(["a", "b"]);
  });
});

describe("default templates", () => {
  it("define every event type for every channel with a non-empty body", () => {
    const events = Object.keys(
      TEMPLATE_PLACEHOLDERS
    ) as NotificationEventType[];
    expect(events.length).toBeGreaterThanOrEqual(16);
    for (const event of events) {
      for (const channel of NOTIFICATION_CHANNELS) {
        expect(DEFAULT_TEMPLATES[event][channel].body.length).toBeGreaterThan(
          0
        );
      }
    }
  });

  it("only reference documented placeholders", () => {
    const common = ["recipientName", "organizationName", "productName", "link"];
    for (const [event, channels] of Object.entries(DEFAULT_TEMPLATES)) {
      const allowed = new Set([
        ...common,
        ...TEMPLATE_PLACEHOLDERS[event as NotificationEventType],
      ]);
      for (const tpl of Object.values(channels)) {
        for (const name of extractPlaceholders(tpl))
          expect(allowed.has(name), `${event}:${name}`).toBe(true);
      }
    }
  });
});

describe("getTemplate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the built-in default when the organisation has no override", async () => {
    findMany.mockResolvedValue([]);
    const tpl = await getTemplate("org-1", "RENEWAL_REMINDER", "EMAIL");
    expect(tpl.source).toBe("default");
    expect(tpl.subject).toContain("renews in");
  });

  it("prefers the requested locale, then the default locale", async () => {
    findMany.mockResolvedValue([
      { locale: "en", subject: "EN subject", body: "EN body" },
      { locale: "ko", subject: "KO subject", body: "KO body" },
    ]);
    const ko = await getTemplate("org-1", "RENEWAL_REMINDER", "IN_APP", "ko");
    expect(ko).toMatchObject({
      source: "custom",
      locale: "ko",
      subject: "KO subject",
    });
    findMany.mockResolvedValue([
      { locale: "en", subject: "EN subject", body: "EN body" },
    ]);
    const fallback = await getTemplate(
      "org-1",
      "RENEWAL_REMINDER",
      "IN_APP",
      "ko"
    );
    expect(fallback).toMatchObject({ source: "custom", locale: "en" });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      })
    );
  });
});
