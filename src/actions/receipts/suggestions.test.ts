// src/actions/receipts/suggestions.test.ts
import { createSubscription } from "@/actions/subscriptions";
import { prisma } from "@/lib/db";
import { ForbiddenError, requirePermission } from "@/lib/rbac/service";
import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getLinkableSubscriptions,
  getReceiptSuggestions,
} from "./suggestions-read";
import {
  acceptReceiptSuggestion,
  dismissReceiptSuggestions,
  linkReceiptSuggestion,
} from "./suggestions-write";

vi.mock("@/lib/db", () => ({
  prisma: {
    receiptSuggestion: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    subscription: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    app: { findFirst: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));
vi.mock("@/lib/rbac/service", () => {
  class ForbiddenError extends Error {
    constructor(public readonly permission: string | string[]) {
      super("You do not have permission to perform this action");
      this.name = "ForbiddenError";
    }
  }
  return {
    ForbiddenError,
    isForbiddenError: (e: unknown) => e instanceof ForbiddenError,
    requirePermission: vi.fn(),
  };
});
vi.mock("@/actions/subscriptions", () => ({ createSubscription: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const db = prisma as unknown as Record<
  string,
  Record<string, ReturnType<typeof vi.fn>>
>;
const mockedRequire = requirePermission as unknown as ReturnType<typeof vi.fn>;
const mockedCreate = createSubscription as unknown as ReturnType<typeof vi.fn>;

function grant(keys: string[]) {
  mockedRequire.mockImplementation(
    async (permission: string | string[], options?: { mode?: string }) => {
      const list = Array.isArray(permission) ? permission : [permission];
      const ok =
        (options?.mode ?? "all") === "all"
          ? list.every((k) => keys.includes(k))
          : list.some((k) => keys.includes(k));
      if (!ok) throw new ForbiddenError(permission);
      return {
        userId: "user-1",
        organizationId: "org-1",
        role: "MEMBER",
        permissions: new Set(keys),
      };
    }
  );
}

const suggestionRow = {
  id: "sug-1",
  mailboxId: "mb-1",
  messageId: "m1",
  vendorName: "Notion",
  senderEmail: "team@notion.so",
  subject: "Your Notion receipt",
  amount: { toString: () => "12.00" },
  currency: "USD",
  billingCycle: "MONTHLY",
  chargedAt: new Date("2026-01-05T00:00:00Z"),
  nextRenewalAt: new Date("2026-02-05T00:00:00Z"),
  confidence: 0.9,
  snippet: "Thanks",
  status: "NEW",
  matchedSubscriptionId: "sub-9",
  matchedCatalogId: "cat-1",
  createdAt: new Date("2026-01-05T01:00:00Z"),
  mailbox: { email: "me@acme.com", provider: "GMAIL" },
  matchedCatalog: {
    id: "cat-1",
    name: "Notion",
    logoUrl: null,
    category: "Productivity",
    website: "https://notion.so",
  },
};

const acceptInput = {
  name: "Notion",
  amount: 12,
  currency: "usd",
  billingCycle: "MONTHLY" as const,
  startDate: "2026-01-05",
  renewalDate: "2026-02-05",
  categoryId: "cat-prod",
  isTrial: false,
};

describe("getReceiptSuggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.receiptSuggestion.findMany.mockResolvedValue([suggestionRow]);
    db.receiptSuggestion.count.mockResolvedValue(1);
    db.receiptSuggestion.groupBy.mockResolvedValue([
      { status: "NEW", _count: { _all: 1 } },
      { status: "DISMISSED", _count: { _all: 4 } },
    ]);
    db.subscription.findMany.mockResolvedValue([
      { id: "sub-9", amount: 10, currency: "USD", app: { name: "Notion" } },
    ]);
  });

  it("scopes to the caller's own mailboxes without mailboxes:manage", async () => {
    grant(["mailboxes:connect_own"]);
    const result = await getReceiptSuggestions({
      status: "NEW",
      minConfidence: 0.7,
      search: "notion",
    });
    expect(result.success).toBe(true);
    const where = db.receiptSuggestion.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      organizationId: "org-1",
      userId: "user-1",
      status: "NEW",
      confidence: { gte: 0.7 },
    });
    expect(where.OR).toHaveLength(3);
    expect(result.data?.items[0]).toMatchObject({
      id: "sug-1",
      amount: 12,
      chargedAt: "2026-01-05T00:00:00.000Z",
      matchedSubscription: {
        id: "sub-9",
        appName: "Notion",
        amount: 10,
        currency: "USD",
      },
    });
    expect(result.data?.counts).toEqual({
      NEW: 1,
      ACCEPTED: 0,
      DISMISSED: 4,
      DUPLICATE: 0,
    });
  });

  it("widens to the organisation with mailboxes:manage and applies pagination", async () => {
    grant(["mailboxes:manage"]);
    const result = await getReceiptSuggestions({
      page: 2,
      limit: 10,
      mailboxId: "mb-1",
    });
    const args = db.receiptSuggestion.findMany.mock.calls[0][0];
    expect(args.where.userId).toBeUndefined();
    expect(args.where.mailboxId).toBe("mb-1");
    expect(args).toMatchObject({ skip: 10, take: 10 });
    expect(result.data?.page).toBe(2);
  });

  it("filters by several mailboxes (array or CSV) and ignores an empty list", async () => {
    grant(["mailboxes:manage"]);
    await getReceiptSuggestions({ mailboxIds: ["mb-1", "mb-2"] });
    expect(
      db.receiptSuggestion.findMany.mock.calls.at(-1)![0].where.mailboxId
    ).toEqual({ in: ["mb-1", "mb-2"] });

    await getReceiptSuggestions({ mailboxId: "mb-1,mb-3" });
    expect(
      db.receiptSuggestion.findMany.mock.calls.at(-1)![0].where.mailboxId
    ).toEqual({ in: ["mb-1", "mb-3"] });

    await getReceiptSuggestions({ mailboxIds: [] });
    expect(
      db.receiptSuggestion.findMany.mock.calls.at(-1)![0].where.mailboxId
    ).toBeUndefined();
  });

  it("rejects invalid filters and forbidden callers", async () => {
    grant(["mailboxes:manage"]);
    expect((await getReceiptSuggestions({ minConfidence: 7 })).success).toBe(
      false
    );
    grant([]);
    const forbidden = await getReceiptSuggestions();
    expect(forbidden).toMatchObject({
      success: false,
      error: expect.stringMatching(/permission/),
    });
  });

  it("lists linkable subscriptions filtered by app name", async () => {
    grant(["mailboxes:connect_own"]);
    db.subscription.findMany.mockResolvedValue([
      {
        id: "s1",
        amount: { toString: () => "5" },
        currency: "AED",
        billingCycle: "YEARLY",
        app: { name: "Slack" },
      },
    ]);
    const result = await getLinkableSubscriptions("sla");
    expect(result.data).toEqual([
      {
        id: "s1",
        appName: "Slack",
        amount: 5,
        currency: "AED",
        billingCycle: "YEARLY",
      },
    ]);
    expect(
      db.subscription.findMany.mock.calls[0][0].where.app.name.contains
    ).toBe("sla");
  });
});

describe("acceptReceiptSuggestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    grant(["mailboxes:connect_own", "subscriptions:create"]);
    db.receiptSuggestion.findFirst.mockResolvedValue(suggestionRow);
    db.receiptSuggestion.update.mockResolvedValue({});
    db.app.findFirst.mockResolvedValue(null);
    db.app.create.mockResolvedValue({ id: "app-new" });
    db.subscription.findFirst.mockResolvedValue(null);
    db.subscription.update.mockResolvedValue({});
    db.auditLog.create.mockResolvedValue({});
    mockedCreate.mockResolvedValue({ success: true, data: { id: "sub-new" } });
  });

  it("creates the app and subscription, then marks the suggestion accepted", async () => {
    const result = await acceptReceiptSuggestion("sug-1", acceptInput);

    expect(result).toMatchObject({
      success: true,
      data: { subscriptionId: "sub-new", appId: "app-new", linked: false },
    });
    expect(db.app.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "org-1",
          name: "Notion",
          catalogId: "cat-1",
          categoryId: "cat-prod",
          source: "MANUAL",
        }),
      })
    );
    const form: FormData = mockedCreate.mock.calls[0][1];
    expect(form.get("appId")).toBe("app-new");
    expect(form.get("amount")).toBe("12.00");
    expect(form.get("currency")).toBe("USD");
    expect(form.get("billingCycle")).toBe("MONTHLY");
    expect(form.get("renewalDate")).toBe("2026-02-05");
    expect(db.subscription.update).toHaveBeenCalledWith({
      where: { id: "sub-new" },
      data: {
        categoryId: "cat-prod",
        isTrial: false,
        trialEndsAt: null,
        lastDetectedAmount: 12,
      },
    });
    expect(db.receiptSuggestion.update).toHaveBeenCalledWith({
      where: { id: "sug-1" },
      data: { status: "ACCEPTED", matchedSubscriptionId: "sub-new" },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "ACCEPT_RECEIPT_SUGGESTION",
          entityId: "sug-1",
        }),
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith("/subscriptions/receipts");
  });

  it("reuses an existing app and links when that app already has a subscription", async () => {
    db.app.findFirst.mockResolvedValue({ id: "app-old" });
    db.subscription.findFirst.mockResolvedValue({ id: "sub-old" });

    const result = await acceptReceiptSuggestion("sug-1", acceptInput);

    expect(result.data).toEqual({
      subscriptionId: "sub-old",
      appId: "app-old",
      linked: true,
    });
    expect(mockedCreate).not.toHaveBeenCalled();
    expect(db.app.create).not.toHaveBeenCalled();
    expect(db.subscription.update).toHaveBeenCalledWith({
      where: { id: "sub-old" },
      data: { lastDetectedAmount: 12 },
    });
  });

  it("surfaces createSubscription failures", async () => {
    mockedCreate.mockResolvedValue({
      success: false,
      message: "VIEWER cannot create",
      errors: { amount: ["bad"] },
    });
    const result = await acceptReceiptSuggestion("sug-1", acceptInput);
    expect(result).toMatchObject({
      success: false,
      error: "VIEWER cannot create",
      errors: { amount: ["bad"] },
    });
    expect(db.receiptSuggestion.update).not.toHaveBeenCalled();
  });

  it("requires subscriptions:create in addition to mailbox scope", async () => {
    grant(["mailboxes:connect_own"]);
    const result = await acceptReceiptSuggestion("sug-1", acceptInput);
    expect(result).toMatchObject({
      success: false,
      error: expect.stringMatching(/permission/),
    });
  });

  it("validates overrides and rejects unknown or decided suggestions", async () => {
    expect(
      (
        await acceptReceiptSuggestion("sug-1", {
          ...acceptInput,
          currency: "US",
        })
      ).success
    ).toBe(false);
    expect(
      (await acceptReceiptSuggestion("sug-1", { ...acceptInput, amount: -1 }))
        .success
    ).toBe(false);
    db.receiptSuggestion.findFirst.mockResolvedValue(null);
    expect(await acceptReceiptSuggestion("missing", acceptInput)).toMatchObject(
      { success: false, error: "Suggestion not found" }
    );
    expect(
      db.receiptSuggestion.findFirst.mock.calls[0][0].where.status
    ).toEqual({ in: ["NEW", "DUPLICATE"] });
  });
});

describe("linkReceiptSuggestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    grant(["mailboxes:connect_own"]);
    db.receiptSuggestion.findFirst.mockResolvedValue(suggestionRow);
    db.receiptSuggestion.update.mockResolvedValue({});
    db.subscription.findFirst.mockResolvedValue({ id: "sub-2" });
    db.subscription.update.mockResolvedValue({});
    db.auditLog.create.mockResolvedValue({});
  });

  it("links and updates lastDetectedAmount by default", async () => {
    const result = await linkReceiptSuggestion("sug-1", {
      subscriptionId: "sub-2",
    });
    expect(result).toMatchObject({
      success: true,
      data: { subscriptionId: "sub-2" },
    });
    expect(db.subscription.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub-2", organizationId: "org-1" },
      })
    );
    expect(db.subscription.update).toHaveBeenCalledWith({
      where: { id: "sub-2" },
      data: { lastDetectedAmount: suggestionRow.amount },
    });
    expect(db.receiptSuggestion.update).toHaveBeenCalledWith({
      where: { id: "sug-1" },
      data: { status: "ACCEPTED", matchedSubscriptionId: "sub-2" },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "LINK_RECEIPT_SUGGESTION" }),
      })
    );
  });

  it("can skip the amount update and rejects foreign subscriptions", async () => {
    await linkReceiptSuggestion("sug-1", {
      subscriptionId: "sub-2",
      updateLastDetectedAmount: false,
    });
    expect(db.subscription.update).not.toHaveBeenCalled();
    db.subscription.findFirst.mockResolvedValue(null);
    expect(
      await linkReceiptSuggestion("sug-1", { subscriptionId: "other-org" })
    ).toMatchObject({ success: false, error: "Subscription not found" });
    expect(
      await linkReceiptSuggestion("sug-1", { subscriptionId: "" })
    ).toMatchObject({ success: false });
  });
});

describe("dismissReceiptSuggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    grant(["mailboxes:connect_own"]);
    db.receiptSuggestion.updateMany.mockResolvedValue({ count: 2 });
    db.auditLog.create.mockResolvedValue({});
  });

  it("bulk-dismisses only open suggestions in scope and audits once", async () => {
    const result = await dismissReceiptSuggestions(["a", "b"]);
    expect(result).toEqual({ success: true, data: { count: 2 } });
    expect(db.receiptSuggestion.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["a", "b"] },
        organizationId: "org-1",
        userId: "user-1",
        status: { in: ["NEW", "DUPLICATE"] },
      },
      data: { status: "DISMISSED" },
    });
    expect(db.auditLog.create).toHaveBeenCalledTimes(1);
    expect(db.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: "DISMISS_RECEIPT_SUGGESTION",
      entityId: null,
      changes: { ids: ["a", "b"], count: 2 },
    });
  });

  it("skips the audit when nothing changed and validates input", async () => {
    db.receiptSuggestion.updateMany.mockResolvedValue({ count: 0 });
    await dismissReceiptSuggestions(["zzz"]);
    expect(db.auditLog.create).not.toHaveBeenCalled();
    expect((await dismissReceiptSuggestions([])).success).toBe(false);
  });
});
