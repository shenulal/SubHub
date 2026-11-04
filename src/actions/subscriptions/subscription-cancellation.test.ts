import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/service";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setSubscriptionCancellationOverride } from "./subscription-cancellation";

vi.mock("@/lib/db", () => ({
  prisma: {
    subscription: { findFirst: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));
vi.mock("@/lib/rbac/service", () => ({
  requirePermission: vi.fn(),
  isForbiddenError: () => false,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("setSubscriptionCancellationOverride", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requirePermission).mockResolvedValue({
      organizationId: "org-1",
      userId: "user-1",
    } as never);
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
      id: "sub-1",
      cancellationUrl: null,
      cancellationNotes: null,
    } as never);
  });

  it("stores the override, blanking empty strings, and audits", async () => {
    const result = await setSubscriptionCancellationOverride("sub-1", {
      cancellationUrl: "",
      cancellationNotes: "  Email support  ",
    });
    expect(requirePermission).toHaveBeenCalledWith("subscriptions:update");
    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: { cancellationUrl: null, cancellationNotes: "Email support" },
    });
    expect(prisma.auditLog.create).toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      data: { cancellationUrl: null, cancellationNotes: "Email support" },
    });
  });

  it("rejects invalid urls and unknown subscriptions", async () => {
    expect(
      (
        await setSubscriptionCancellationOverride("sub-1", {
          cancellationUrl: "not a url",
        })
      ).success
    ).toBe(false);
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null);
    expect(
      (
        await setSubscriptionCancellationOverride("x", {
          cancellationNotes: "n",
        })
      ).error
    ).toBe("Subscription not found");
  });
});
