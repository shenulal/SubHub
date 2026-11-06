// src/actions/extensions/onboarding-monitor.ts
"use server";

import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/service";

export interface OnboardingMonitorItem {
  userId: string;
  userName: string | null;
  userEmail: string;
  department: string | null;
  onboardingCompletedAt: Date | null;
}

/**
 * Fetch onboarding status for all active users
 */
export async function getOnboardingMonitorData(): Promise<{
  items: OnboardingMonitorItem[];
  total: number;
  completedCount: number;
  pendingCount: number;
}> {
  const { organizationId } = await requirePermission("extensions:read");

  const users = await prisma.user.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      name: true,
      email: true,
      department: true,
      extensionDevices: {
        where: { onboardingCompletedAt: { not: null } },
        select: { onboardingCompletedAt: true },
        orderBy: { onboardingCompletedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  });

  const items: OnboardingMonitorItem[] = users.map((user) => ({
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    department: user.department,
    onboardingCompletedAt:
      user.extensionDevices[0]?.onboardingCompletedAt ?? null,
  }));

  const completedCount = items.filter((i) => i.onboardingCompletedAt).length;
  const pendingCount = items.length - completedCount;

  return { items, total: items.length, completedCount, pendingCount };
}
