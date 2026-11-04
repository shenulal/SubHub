import { prisma } from "@/lib/db";
import { ForbiddenError, requirePermission } from "@/lib/rbac/service";
import { findSimilarSubscriptions } from "@/lib/services/subscription/duplicates";
import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  archiveSubscription,
  bulkUpdateSubscriptions,
  cancelSubscription,
  checkDuplicate,
  pauseSubscription,
  restoreSubscription,
  resumeSubscription,
} from "./subscription-lifecycle";
import {
  buildTransitionPatch,
  canTransition,
} from "./subscription-lifecycle.helpers";
import { ensureTags } from "./taxonomy-adapter";

vi.mock("@/lib/db", () => ({
  prisma: {
    subscription: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    subscriptionTag: { deleteMany: vi.fn(), createMany: vi.fn() },
    auditLog: { create: vi.fn(), createMany: vi.fn(), findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/rbac/service", () => {
  class ForbiddenError extends Error {
    constructor(public readonly permission: string) {
      super("forbidden");
      this.name = "ForbiddenError";
    }
  }
  return {
    ForbiddenError,
    isForbiddenError: (e: unknown) => e instanceof ForbiddenError,
    requirePermission: vi.fn(),
  };
});
vi.mock("@/lib/services/subscription/duplicates", () => ({
  findSimilarSubscriptions: vi.fn(),
}));
vi.mock("./taxonomy-adapter", () => ({ ensureTags: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const ctx = {
  organizationId: "org-1",
  userId: "user-1",
  role: "ADMIN",
  permissions: new Set<string>(),
};

function mockExisting(status: string) {
  vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
    id: "sub-1",
    status,
    app: { name: "Slack" },
  } as never);
}

describe("lifecycle helpers", () => {
  it("encodes the allowed transitions", () => {
    expect(canTransition("pause", "ACTIVE")).toBe(true);
    expect(canTransition("pause", "PAUSED")).toBe(false);
    expect(canTransition("resume", "PAUSED")).toBe(true);
    expect(canTransition("resume", "ACTIVE")).toBe(false);
    expect(canTransition("archive", "CANCELLED")).toBe(true);
    expect(canTransition("archive", "ARCHIVED")).toBe(false);
    expect(canTransition("restore", "ARCHIVED")).toBe(true);
    expect(canTransition("cancel", "ARCHIVED")).toBe(false);
  });

  it("restores to the previous status or ACTIVE", () => {
    const now = new Date("2026-11-04T00:00:00Z");
    expect(
      buildTransitionPatch("restore", { now, previousStatus: "PAUSED" })
    ).toEqual({ status: "PAUSED", archivedAt: null, pausedAt: now });
    expect(
      buildTransitionPatch("restore", { now, previousStatus: null })
    ).toEqual({ status: "ACTIVE", archivedAt: null, pausedAt: null });
    expect(
      buildTransitionPatch("restore", { now, previousStatus: "ARCHIVED" })
        .status
    ).toBe("ACTIVE");
  });

  it("cancel keeps the supplied effective date as endDate", () => {
    const now = new Date("2026-11-04T00:00:00Z");
    const effective = new Date("2026-12-31T00:00:00Z");
    expect(
      buildTransitionPatch("cancel", { now, effectiveDate: effective })
    ).toMatchObject({
      status: "CANCELLED",
      endDate: effective,
      autoRenewal: false,
    });
    expect(buildTransitionPatch("cancel", { now }).endDate).toEqual(now);
  });
});

describe("subscription lifecycle actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requirePermission).mockResolvedValue(ctx as never);
    vi.mocked(prisma.subscription.update).mockImplementation((async (args: {
      data: { status: string };
    }) => ({
      id: "sub-1",
      status: args.data.status,
    })) as never);
  });

  it("pauses an active subscription and audits it", async () => {
    mockExisting("ACTIVE");
    const result = await pauseSubscription("sub-1");
    expect(result).toEqual({
      success: true,
      data: { id: "sub-1", status: "PAUSED" },
    });
    expect(requirePermission).toHaveBeenCalledWith("subscriptions:update");
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PAUSED",
          pausedAt: expect.any(Date),
        }),
      })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "PAUSE_SUBSCRIPTION",
          entityType: "subscription",
          entityId: "sub-1",
          changes: { from: "ACTIVE", to: "PAUSED" },
        }),
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith("/subscriptions/sub-1");
  });

  it("rejects an invalid transition without writing", async () => {
    mockExisting("CANCELLED");
    const result = await pauseSubscription("sub-1");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not allowed/);
    expect(prisma.subscription.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("resumes a paused subscription clearing pausedAt", async () => {
    mockExisting("PAUSED");
    const result = await resumeSubscription("sub-1");
    expect(result.data?.status).toBe("ACTIVE");
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "ACTIVE", pausedAt: null } })
    );
  });

  it("archives and later restores to the archived-from status", async () => {
    mockExisting("PAUSED");
    await archiveSubscription("sub-1");
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "ARCHIVED",
          archivedAt: expect.any(Date),
        }),
      })
    );

    mockExisting("ARCHIVED");
    vi.mocked(prisma.auditLog.findFirst).mockResolvedValue({
      changes: { from: "PAUSED", to: "ARCHIVED" },
    } as never);
    const restored = await restoreSubscription("sub-1");
    expect(restored.data?.status).toBe("PAUSED");
  });

  it("cancels with an effective date and keeps endDate", async () => {
    mockExisting("ACTIVE");
    const result = await cancelSubscription("sub-1", {
      effectiveDate: "2026-12-31",
    });
    expect(result.data?.status).toBe("CANCELLED");
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "CANCELLED",
          endDate: new Date("2026-12-31"),
          autoRenewal: false,
        }),
      })
    );
  });

  it("returns not-found for a subscription outside the organisation", async () => {
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null);
    const result = await archiveSubscription("other");
    expect(result).toEqual({ success: false, error: "Subscription not found" });
  });

  it("maps ForbiddenError to an ActionState error", async () => {
    vi.mocked(requirePermission).mockRejectedValue(
      new ForbiddenError("subscriptions:update")
    );
    const result = await pauseSubscription("sub-1");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/permission/);
  });

  it("rethrows Next.js redirects", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;/login",
    });
    vi.mocked(requirePermission).mockRejectedValue(redirect);
    await expect(pauseSubscription("sub-1")).rejects.toBe(redirect);
  });
});

describe("bulkUpdateSubscriptions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requirePermission).mockResolvedValue(ctx as never);
    vi.mocked(prisma.subscription.findMany).mockResolvedValue([
      { id: "sub-1", status: "ACTIVE" },
      { id: "sub-2", status: "PAUSED" },
    ] as never);
    vi.mocked(ensureTags).mockResolvedValue([{ id: "tag-1", name: "Finance" }]);
  });

  it("requires subscriptions:bulk and ignores foreign ids", async () => {
    const result = await bulkUpdateSubscriptions(
      ["sub-1", "sub-2", "foreign"],
      {
        categoryId: "cat-1",
        addTagNames: ["Finance"],
        removeTagIds: ["tag-old"],
        archive: true,
      }
    );
    expect(requirePermission).toHaveBeenCalledWith("subscriptions:bulk");
    expect(result).toEqual({ success: true, data: { updated: 2 } });
    expect(prisma.subscription.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["sub-1", "sub-2"] }, organizationId: "org-1" },
      data: expect.objectContaining({
        categoryId: "cat-1",
        status: "ARCHIVED",
        archivedAt: expect.any(Date),
      }),
    });
    expect(prisma.subscriptionTag.deleteMany).toHaveBeenCalledWith({
      where: {
        subscriptionId: { in: ["sub-1", "sub-2"] },
        tagId: { in: ["tag-old"] },
      },
    });
    expect(prisma.subscriptionTag.createMany).toHaveBeenCalledWith({
      data: [
        { subscriptionId: "sub-1", tagId: "tag-1" },
        { subscriptionId: "sub-2", tagId: "tag-1" },
      ],
      skipDuplicates: true,
    });
    expect(prisma.auditLog.createMany).toHaveBeenCalled();
  });

  it("skips the column update when only tags change", async () => {
    await bulkUpdateSubscriptions(["sub-1"], { addTagNames: ["Finance"] });
    expect(prisma.subscription.updateMany).not.toHaveBeenCalled();
    expect(prisma.subscriptionTag.createMany).toHaveBeenCalled();
  });

  it("rejects empty ids and empty patches", async () => {
    expect((await bulkUpdateSubscriptions([], { archive: true })).success).toBe(
      false
    );
    expect((await bulkUpdateSubscriptions(["sub-1"], {})).success).toBe(false);
    expect(prisma.subscription.updateMany).not.toHaveBeenCalled();
  });

  it("returns not-found when no ids belong to the organisation", async () => {
    vi.mocked(prisma.subscription.findMany).mockResolvedValue([] as never);
    const result = await bulkUpdateSubscriptions(["x"], { ownerId: null });
    expect(result).toEqual({ success: false, error: "Subscription not found" });
  });
});

describe("checkDuplicate", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requirePermission).mockResolvedValue(ctx as never);
  });

  it("delegates to the duplicates service with org scoping", async () => {
    vi.mocked(findSimilarSubscriptions).mockResolvedValue([
      {
        subscriptionId: "sub-1",
        appName: "Slack",
        similarity: 1,
        reason: "name",
        status: "ACTIVE",
        amount: 10,
        currency: "USD",
      },
    ]);
    const result = await checkDuplicate("Slack", "slack.com", "sub-9");
    expect(findSimilarSubscriptions).toHaveBeenCalledWith(
      "org-1",
      { name: "Slack", vendorDomain: "slack.com" },
      { excludeId: "sub-9" }
    );
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
  });

  it("rejects blank names", async () => {
    const result = await checkDuplicate("   ");
    expect(result.success).toBe(false);
    expect(findSimilarSubscriptions).not.toHaveBeenCalled();
  });
});
