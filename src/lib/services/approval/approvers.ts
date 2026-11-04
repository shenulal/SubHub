// src/lib/services/approval/approvers.ts
/**
 * Feature 3.4 support — the users who approved the request that created a
 * subscription. The notifications area copies them on renewal reminders when
 * `notifications.copyApproversOnRenewal` is on.
 */
import { prisma } from "@/lib/db";

export async function getApproversForSubscription(
  subscriptionId: string
): Promise<string[]> {
  const request = await prisma.approvalRequest.findFirst({
    where: { subscriptionId, status: "APPROVED" },
    select: {
      steps: {
        where: { status: "APPROVED" },
        select: { approverId: true },
      },
    },
  });
  if (!request) return [];
  return Array.from(new Set(request.steps.map((s) => s.approverId)));
}
