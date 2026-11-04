// src/actions/budget-settings.ts
"use server";

/**
 * Budget settings — thin compatibility layer over the settings registry.
 * Values live in `finance.monthlyBudget`, `finance.budgetAlertThresholdPercent`
 * and `finance.baseCurrency`; the UI lives at /settings/workspace/finance.
 */
import { requireOrganization } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/logging";
import { isForbiddenError, requirePermission } from "@/lib/rbac/service";
import {
  getSettings,
  setOrganizationSettings,
  SettingValidationError,
} from "@/lib/settings/service";
import { BudgetSettings } from "@/types/budget";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

const BUDGET_KEYS = [
  "finance.baseCurrency",
  "finance.monthlyBudget",
  "finance.budgetAlertThresholdPercent",
] as const;

/**
 * Resolve budget settings for an organisation from the registry.
 */
export async function getBudgetSettingsForOrganization(
  organizationId: string
): Promise<BudgetSettings> {
  const s = await getSettings(organizationId, BUDGET_KEYS);
  return {
    currency: s["finance.baseCurrency"],
    monthlyBudget: s["finance.monthlyBudget"],
    alertThreshold: s["finance.budgetAlertThresholdPercent"],
  };
}

/**
 * 조직 예산 설정 조회 (current session)
 */
export async function getBudgetSettings(): Promise<BudgetSettings> {
  const { organizationId } = await requireOrganization();
  return getBudgetSettingsForOrganization(organizationId);
}

/**
 * 조직 예산 설정 업데이트 (permission: budgets:manage)
 */
async function _updateBudgetSettings(
  updates: Partial<BudgetSettings>
): Promise<{ success: boolean; message?: string }> {
  try {
    const { organizationId, userId } =
      await requirePermission("budgets:manage");
    const current = await getBudgetSettingsForOrganization(organizationId);
    const next: BudgetSettings = {
      currency: updates.currency ?? current.currency,
      monthlyBudget:
        updates.monthlyBudget !== undefined
          ? updates.monthlyBudget
          : current.monthlyBudget,
      alertThreshold: updates.alertThreshold ?? current.alertThreshold,
    };
    await setOrganizationSettings(
      organizationId,
      {
        "finance.baseCurrency": next.currency,
        "finance.monthlyBudget": next.monthlyBudget,
        "finance.budgetAlertThresholdPercent": next.alertThreshold,
      },
      userId
    );
    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action: "UPDATE_SETTINGS",
        entityType: "OrganizationSetting",
        entityId: "finance",
        changes: {
          from: current,
          to: next,
        } as unknown as Prisma.InputJsonValue,
      },
    });
    revalidatePath("/settings/budget");
    revalidatePath("/settings/workspace/finance");
    return { success: true };
  } catch (error) {
    if (isForbiddenError(error) || error instanceof SettingValidationError) {
      return { success: false, message: error.message };
    }
    throw error;
  }
}
export const updateBudgetSettings = withLogging(
  "updateBudgetSettings",
  _updateBudgetSettings
);

/**
 * 차트용 월별 예산 조회
 * - monthlyBudget이 설정되어 있으면 해당 값 반환
 * - 설정되지 않았으면 (null) 전월 카드 매입 승인 내역 총액 반환
 */
export async function getMonthlyBudgetForChart(
  organizationId: string,
  month: Date,
  budgetSettings: BudgetSettings
): Promise<number> {
  // 예산이 설정되어 있으면 해당 값 반환
  if (budgetSettings.monthlyBudget !== null) {
    return budgetSettings.monthlyBudget;
  }

  // Fallback: 전월 카드 매입 승인 내역 총액
  const prevMonth = new Date(month);
  prevMonth.setMonth(prevMonth.getMonth() - 1);

  const year = prevMonth.getFullYear();
  const monthNum = prevMonth.getMonth() + 1; // 0-indexed -> 1-indexed

  const prevMonthStart = `${year}${String(monthNum).padStart(2, "0")}01`;
  const prevMonthEnd = `${year}${String(monthNum).padStart(2, "0")}31`;

  const cardTransactions = await prisma.cardTransaction.aggregate({
    where: {
      organizationId,
      useDt: {
        gte: prevMonthStart,
        lte: prevMonthEnd,
      },
    },
    _sum: { useAmt: true },
  });

  // Decimal 타입 처리
  const sum = cardTransactions._sum.useAmt;
  if (sum === null) {
    return 0;
  }

  // Prisma Decimal은 toNumber() 메서드를 가짐
  if (typeof sum === "object" && "toNumber" in sum) {
    return (sum as { toNumber: () => number }).toNumber();
  }

  return Number(sum);
}
