// src/actions/approvals/summary.ts
"use server";

/**
 * Feature 4.4 — pending approvals summary for the dashboard card and the top of
 * the inbox. Monthly amounts are converted into the organisation base currency.
 */
import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/logging";
import { requirePermission } from "@/lib/rbac/service";
import { roundMoney } from "@/lib/services/approval/cycle";
import { convertAmount } from "@/lib/services/approval/fx";
import { isAdminRole } from "@/lib/services/approval/shared";
import { getSetting } from "@/lib/settings/service";
import type { ActionState } from "@/types";
import type { PendingApprovalsSummary } from "@/types/approval";
import type { Prisma } from "@prisma/client";
import { isAwaitingUser, LIST_INCLUDE, runAction, toListItem } from "./shared";

/** Number of highlighted requests on the card (UI constant). */
const TOP_ITEMS = 5;

function scopeWhere(
  organizationId: string,
  userId: string,
  canReadAll: boolean
): Prisma.ApprovalRequestWhereInput {
  const base: Prisma.ApprovalRequestWhereInput = {
    organizationId,
    status: { in: ["PENDING", "INFO_REQUESTED"] },
  };
  if (canReadAll) return base;
  return {
    ...base,
    OR: [
      { requesterId: userId },
      { steps: { some: { approverId: userId } } },
      { metadata: { path: ["candidateIds"], array_contains: [userId] } },
    ],
  };
}

/** Requests awaiting the viewer come first, then the largest by monthly cost. */
function topItems<T extends Parameters<typeof isAwaitingUser>[0]>(
  rows: T[],
  userId: string
): T[] {
  const mine = rows.filter((r) => isAwaitingUser(r, userId));
  const rest = rows.filter((r) => !isAwaitingUser(r, userId));
  return [...mine, ...rest].slice(0, TOP_ITEMS);
}

async function _getPendingApprovalsSummary(): Promise<
  ActionState<PendingApprovalsSummary>
> {
  return runAction("getPendingApprovalsSummary", async () => {
    const { organizationId, userId, role, permissions } =
      await requirePermission("approvals:read");
    const canReadAll = permissions.has("approvals:read_all");
    const where = scopeWhere(organizationId, userId, canReadAll);
    const [currency, rows] = await Promise.all([
      getSetting(organizationId, "finance.baseCurrency"),
      prisma.approvalRequest.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: { monthlyAmount: "desc" },
      }),
    ]);
    const rates = new Map<string, number>();
    let committed = 0;
    for (const row of rows) {
      const monthly = Number(row.monthlyAmount);
      if (!rates.has(row.currency)) {
        rates.set(row.currency, await convertAmount(1, row.currency, currency));
      }
      committed += monthly * (rates.get(row.currency) ?? 1);
    }
    return {
      success: true,
      data: {
        count: rows.length,
        committedMonthly: roundMoney(committed),
        currency,
        items: topItems(rows, userId).map((r) =>
          toListItem(r, {
            userId,
            isAdmin: isAdminRole(role),
            hasDecidePermission: permissions.has("approvals:decide"),
          })
        ),
      },
    };
  });
}
export const getPendingApprovalsSummary = withLogging(
  "getPendingApprovalsSummary",
  _getPendingApprovalsSummary
);
