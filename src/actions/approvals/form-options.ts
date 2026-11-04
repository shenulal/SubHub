// src/actions/approvals/form-options.ts
"use server";

/**
 * Option lists for the request form (2.1) and the policy builder (2.2/2.3).
 * Everything comes from master data or the settings registry.
 */
import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/logging";
import { requirePermission } from "@/lib/rbac/service";
import { getSettings } from "@/lib/settings/service";
import { catalogSearchSchema } from "@/lib/validations/approvals";
import type { ActionState } from "@/types";
import type {
  ApprovalCategoryOption,
  ApprovalFormOptions,
  CatalogSuggestion,
  PolicyFormOptions,
} from "@/types/approval";
import { runAction, USER_REF_SELECT } from "./shared";

/** Max autocomplete rows returned to the client (UI constant, not a tunable). */
const CATALOG_SUGGESTION_LIMIT = 8;

async function loadCategories(
  organizationId: string
): Promise<ApprovalCategoryOption[]> {
  const rows = await prisma.category.findMany({
    where: { organizationId, isArchived: false },
    select: { id: true, name: true, parentId: true, color: true, icon: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return rows;
}

async function _getApprovalFormOptions(): Promise<
  ActionState<ApprovalFormOptions>
> {
  return runAction("getApprovalFormOptions", async () => {
    const { organizationId } = await requirePermission("approvals:create");
    const [settings, cycles, categories, costCenters] = await Promise.all([
      getSettings(organizationId, [
        "finance.enabledCurrencies",
        "finance.baseCurrency",
        "approvals.justificationMinLength",
      ] as const),
      prisma.billingCycleConfig.findMany({
        where: { organizationId, isEnabled: true },
        select: { cycle: true, label: true, months: true },
        orderBy: { sortOrder: "asc" },
      }),
      loadCategories(organizationId),
      prisma.costCenter.findMany({
        where: { organizationId, isActive: true },
        select: { id: true, code: true, name: true },
        orderBy: { code: "asc" },
      }),
    ]);
    return {
      success: true,
      data: {
        currencies: settings["finance.enabledCurrencies"],
        defaultCurrency: settings["finance.baseCurrency"],
        cycles,
        categories,
        costCenters,
        justificationMinLength: settings["approvals.justificationMinLength"],
      },
    };
  });
}
export const getApprovalFormOptions = withLogging(
  "getApprovalFormOptions",
  _getApprovalFormOptions
);

async function _searchCatalog(
  rawQuery: string
): Promise<ActionState<CatalogSuggestion[]>> {
  return runAction("searchCatalog", async () => {
    await requirePermission("approvals:create");
    const parsed = catalogSearchSchema.safeParse({ query: rawQuery });
    if (!parsed.success) return { success: true, data: [] };
    const { query } = parsed.data;
    const rows = await prisma.saaSCatalog.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { aliases: { hasSome: [query, query.toLowerCase()] } },
        ],
      },
      select: {
        id: true,
        name: true,
        website: true,
        logoUrl: true,
        category: true,
      },
      orderBy: { name: "asc" },
      take: CATALOG_SUGGESTION_LIMIT,
    });
    return { success: true, data: rows };
  });
}
export const searchCatalog = withLogging("searchCatalog", _searchCatalog);

async function _getPolicyFormOptions(): Promise<
  ActionState<PolicyFormOptions>
> {
  return runAction("getPolicyFormOptions", async () => {
    const { organizationId } = await requirePermission(
      "approval_policies:read"
    );
    const [settings, users, categories] = await Promise.all([
      getSettings(organizationId, [
        "finance.enabledCurrencies",
        "finance.baseCurrency",
        "approvals.defaultReminderAfterDays",
        "approvals.defaultEscalationAfterDays",
      ] as const),
      prisma.user.findMany({
        where: { organizationId, status: "ACTIVE" },
        select: USER_REF_SELECT,
        orderBy: [{ name: "asc" }, { email: "asc" }],
      }),
      loadCategories(organizationId),
    ]);
    return {
      success: true,
      data: {
        users,
        categories,
        currencies: settings["finance.enabledCurrencies"],
        defaultCurrency: settings["finance.baseCurrency"],
        roles: ["ADMIN", "APPROVER", "MEMBER"],
        defaultReminderAfterDays:
          settings["approvals.defaultReminderAfterDays"],
        defaultEscalationAfterDays:
          settings["approvals.defaultEscalationAfterDays"],
      },
    };
  });
}
export const getPolicyFormOptions = withLogging(
  "getPolicyFormOptions",
  _getPolicyFormOptions
);
