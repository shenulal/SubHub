/**
 * Comments, activity, attachments and price-change actions.
 */
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/service";
import {
  removeAttachmentObject,
  signedAttachmentUrl,
  storeAttachmentObject,
} from "@/lib/services/subscription/storage-adapter";
import { getSettings } from "@/lib/settings/service";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteAttachment,
  listAttachments,
  uploadAttachment,
} from "./attachments";
import { acknowledgePriceChange, listPriceChanges } from "./price-changes";
import {
  addSubscriptionComment,
  getSubscriptionActivity,
  listSubscriptionComments,
} from "./subscription-comments";

vi.mock("@/lib/db", () => ({
  prisma: {
    subscription: { findFirst: vi.fn(), update: vi.fn() },
    subscriptionComment: { findMany: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn(), findMany: vi.fn() },
    attachment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    priceChangeEvent: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));
vi.mock("@/lib/rbac/service", () => ({
  requirePermission: vi.fn(),
  isForbiddenError: () => false,
}));
vi.mock("@/lib/settings/service", () => ({ getSettings: vi.fn() }));
vi.mock("@/lib/services/subscription/storage-adapter", () => ({
  storeAttachmentObject: vi.fn(),
  signedAttachmentUrl: vi.fn(async () => "https://signed.example/x"),
  removeAttachmentObject: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const ctx = {
  organizationId: "org-1",
  userId: "user-1",
  role: "MEMBER",
  permissions: new Set<string>(),
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requirePermission).mockResolvedValue(ctx as never);
  vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
    id: "sub-1",
  } as never);
  vi.mocked(signedAttachmentUrl).mockResolvedValue("https://signed.example/x");
});

describe("comments", () => {
  it("lists comments for a subscription in the organisation", async () => {
    vi.mocked(prisma.subscriptionComment.findMany).mockResolvedValue([
      { id: "c1", body: "hi", createdAt: new Date(), author: null },
    ] as never);
    const result = await listSubscriptionComments("sub-1");
    expect(requirePermission).toHaveBeenCalledWith("subscriptions:read");
    expect(result.data).toHaveLength(1);
  });

  it("adds a comment with comments:create and audits it", async () => {
    vi.mocked(prisma.subscriptionComment.create).mockResolvedValue({
      id: "c2",
      body: "note",
      createdAt: new Date(),
      author: { id: "user-1", name: "A", email: "a@x" },
    } as never);
    const result = await addSubscriptionComment("sub-1", "  note  ");
    expect(requirePermission).toHaveBeenCalledWith("comments:create");
    expect(prisma.subscriptionComment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ body: "note", authorId: "user-1" }),
      })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: "subscription_comment",
          entityId: "sub-1",
        }),
      })
    );
    expect(result.success).toBe(true);
  });

  it("rejects empty comments and unknown subscriptions", async () => {
    expect((await addSubscriptionComment("sub-1", "   ")).success).toBe(false);
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null);
    expect((await addSubscriptionComment("x", "body")).error).toBe(
      "Subscription not found"
    );
  });

  it("merges audit rows across the subscription entity types", async () => {
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([
      {
        id: "a1",
        action: "PAUSE_SUBSCRIPTION",
        entityType: "subscription",
        entityId: "sub-1",
        changes: null,
        metadata: null,
        createdAt: new Date(),
        user: { id: "u", name: "U", email: "u@x" },
      },
    ] as never);
    const result = await getSubscriptionActivity("sub-1");
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          entityId: "sub-1",
          entityType: {
            in: [
              "subscription",
              "Subscription",
              "attachment",
              "subscription_comment",
              "price_change",
            ],
          },
        }),
      })
    );
    expect(result.data?.[0]).toMatchObject({
      action: "PAUSE_SUBSCRIPTION",
      actor: { id: "u" },
    });
  });
});

describe("attachments", () => {
  beforeEach(() => {
    vi.mocked(getSettings).mockResolvedValue({
      "documents.maxAttachmentSizeMb": 1,
      "documents.allowedMimeTypes": ["application/pdf"],
    } as never);
    vi.mocked(prisma.attachment.create).mockResolvedValue({
      id: "att-1",
    } as never);
  });

  it("uploads a valid file under the organisation key and audits", async () => {
    const result = await uploadAttachment({
      subscriptionId: "sub-1",
      fileName: "Master agreement.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("pdf-bytes"),
      kind: "CONTRACT",
    });
    expect(requirePermission).toHaveBeenCalledWith("attachments:upload");
    expect(storeAttachmentObject).toHaveBeenCalledWith(
      expect.stringMatching(
        /^org\/org-1\/subscriptions\/sub-1\/[0-9a-f-]{36}-Master_agreement\.pdf$/
      ),
      expect.any(Buffer),
      "application/pdf"
    );
    expect(prisma.attachment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: "CONTRACT",
          fileName: "Master_agreement.pdf",
          sizeBytes: 9,
        }),
      })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "UPLOAD_ATTACHMENT" }),
      })
    );
    expect(result).toEqual({ success: true, data: { id: "att-1" } });
  });

  it("rejects oversized and disallowed files before storing", async () => {
    const big = await uploadAttachment({
      subscriptionId: "sub-1",
      fileName: "big.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.alloc(2 * 1024 * 1024),
    });
    expect(big.error).toMatch(/maximum attachment size/);
    const exe = await uploadAttachment({
      subscriptionId: "sub-1",
      fileName: "x.exe",
      mimeType: "application/x-msdownload",
      buffer: Buffer.from("x"),
    });
    expect(exe.error).toMatch(/not allowed/);
    expect(storeAttachmentObject).not.toHaveBeenCalled();
  });

  it("falls back to OTHER for an unknown kind", async () => {
    await uploadAttachment({
      subscriptionId: "sub-1",
      fileName: "x.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("x"),
      kind: "WEIRD",
    });
    expect(prisma.attachment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: "OTHER" }),
      })
    );
  });

  it("lists attachments with signed download URLs", async () => {
    vi.mocked(prisma.attachment.findMany).mockResolvedValue([
      {
        id: "att-1",
        kind: "INVOICE",
        fileName: "inv.pdf",
        mimeType: "application/pdf",
        sizeBytes: 10,
        createdAt: new Date(),
        storageKey: "org/org-1/subscriptions/sub-1/k",
        url: null,
        uploadedBy: null,
      },
    ] as never);
    const result = await listAttachments("sub-1");
    expect(requirePermission).toHaveBeenCalledWith("attachments:read");
    expect(result.data?.[0].downloadUrl).toBe("https://signed.example/x");
  });

  it("deletes the object and the row, refusing keys outside the organisation", async () => {
    vi.mocked(prisma.attachment.findFirst).mockResolvedValue({
      id: "att-1",
      storageKey: "org/org-2/subscriptions/sub-1/k",
      subscriptionId: "sub-1",
      fileName: "k",
    } as never);
    await deleteAttachment("att-1");
    expect(requirePermission).toHaveBeenCalledWith("attachments:delete");
    expect(removeAttachmentObject).not.toHaveBeenCalled();
    expect(prisma.attachment.delete).toHaveBeenCalledWith({
      where: { id: "att-1" },
    });

    vi.mocked(prisma.attachment.findFirst).mockResolvedValue({
      id: "att-2",
      storageKey: "org/org-1/subscriptions/sub-1/k",
      subscriptionId: "sub-1",
      fileName: "k",
    } as never);
    await deleteAttachment("att-2");
    expect(removeAttachmentObject).toHaveBeenCalledWith(
      "org/org-1/subscriptions/sub-1/k"
    );
  });
});

describe("price changes", () => {
  it("lists unacknowledged events by default", async () => {
    vi.mocked(prisma.priceChangeEvent.findMany).mockResolvedValue([
      {
        id: "e1",
        subscriptionId: "sub-1",
        previousAmount: 100,
        newAmount: 110,
        currency: "AED",
        changePercent: 10,
        source: "PAYMENT_RECORD",
        detectedAt: new Date(),
        acknowledgedAt: null,
        subscription: { app: { name: "Slack" } },
      },
    ] as never);
    const result = await listPriceChanges();
    expect(prisma.priceChangeEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-1", acknowledgedAt: null },
      })
    );
    expect(result.data?.[0]).toMatchObject({
      appName: "Slack",
      changePercent: 10,
    });
  });

  it("acknowledges and optionally applies the new amount", async () => {
    vi.mocked(prisma.priceChangeEvent.findFirst).mockResolvedValue({
      id: "e1",
      subscriptionId: "sub-1",
      newAmount: 110,
      previousAmount: 100,
      acknowledgedAt: null,
    } as never);
    const result = await acknowledgePriceChange("e1", { applyNewAmount: true });
    expect(requirePermission).toHaveBeenCalledWith("subscriptions:update");
    expect(prisma.priceChangeEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ acknowledgedById: "user-1" }),
      })
    );
    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: { amount: 110 },
    });
    expect(result.data).toEqual({ id: "e1", appliedAmount: 110 });

    vi.mocked(prisma.subscription.update).mockClear();
    await acknowledgePriceChange("e1");
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });
});
