// src/actions/notification-settings.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Mock Prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    subscription: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock revalidatePath
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { updateNotificationSettings } from "./notification-settings";

describe("updateNotificationSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an error for an unauthenticated user", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await updateNotificationSettings(
      "sub-1",
      "renewalAlert30",
      true
    );

    expect(result).toEqual({
      success: false,
      message: "Authentication required",
    });
  });

  it("returns an error for a user without an organization ID", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", organizationId: null },
    } as never);

    const result = await updateNotificationSettings(
      "sub-1",
      "renewalAlert30",
      true
    );

    expect(result).toEqual({
      success: false,
      message: "Organization information is required",
    });
  });

  it("returns an error for a non-existent subscription", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", organizationId: "org-1" },
    } as never);

    vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null);

    const result = await updateNotificationSettings(
      "sub-1",
      "renewalAlert30",
      true
    );

    expect(result).toEqual({
      success: false,
      message: "Subscription not found",
    });
  });

  it("updates notification settings", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", organizationId: "org-1" },
    } as never);

    vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
      id: "sub-1",
      organizationId: "org-1",
    } as never);

    vi.mocked(prisma.subscription.update).mockResolvedValue({
      id: "sub-1",
      renewalAlert30: true,
    } as never);

    const result = await updateNotificationSettings(
      "sub-1",
      "renewalAlert30",
      true
    );

    expect(result.success).toBe(true);
    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: { renewalAlert30: true },
    });
  });

  it("can disable the 30-day alert", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", organizationId: "org-1" },
    } as never);

    vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
      id: "sub-1",
      organizationId: "org-1",
    } as never);

    vi.mocked(prisma.subscription.update).mockResolvedValue({
      id: "sub-1",
      renewalAlert30: false,
    } as never);

    const result = await updateNotificationSettings(
      "sub-1",
      "renewalAlert30",
      false
    );

    expect(result.success).toBe(true);
    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: { renewalAlert30: false },
    });
  });

  it("can update the 60-day alert", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", organizationId: "org-1" },
    } as never);

    vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
      id: "sub-1",
      organizationId: "org-1",
    } as never);

    vi.mocked(prisma.subscription.update).mockResolvedValue({
      id: "sub-1",
      renewalAlert60: true,
    } as never);

    const result = await updateNotificationSettings(
      "sub-1",
      "renewalAlert60",
      true
    );

    expect(result.success).toBe(true);
    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: { renewalAlert60: true },
    });
  });

  it("can update the 90-day alert", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", organizationId: "org-1" },
    } as never);

    vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
      id: "sub-1",
      organizationId: "org-1",
    } as never);

    vi.mocked(prisma.subscription.update).mockResolvedValue({
      id: "sub-1",
      renewalAlert90: true,
    } as never);

    const result = await updateNotificationSettings(
      "sub-1",
      "renewalAlert90",
      true
    );

    expect(result.success).toBe(true);
    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: { renewalAlert90: true },
    });
  });

  it("calls revalidatePath after updating", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", organizationId: "org-1" },
    } as never);

    vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
      id: "sub-1",
      organizationId: "org-1",
    } as never);

    vi.mocked(prisma.subscription.update).mockResolvedValue({
      id: "sub-1",
    } as never);

    await updateNotificationSettings("sub-1", "renewalAlert30", true);

    expect(revalidatePath).toHaveBeenCalledWith("/subscriptions/sub-1");
  });
});
