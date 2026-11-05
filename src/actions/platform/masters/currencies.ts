// src/actions/platform/masters/currencies.ts
"use server";

import {
  ActionError,
  diffRecords,
  toActionError,
  writeAudit,
} from "@/actions/platform/_shared";
import { prisma } from "@/lib/db";
import { isSaas } from "@/lib/deployment/mode";
import {
  refreshExchangeRates,
  setManualRate,
  type RefreshResult,
} from "@/lib/fx/refresh";
import { withLogging } from "@/lib/logging";
import { auditPlatformChange } from "@/lib/platform-audit";
import type { PermissionKey } from "@/lib/rbac/permissions";
import { requirePermission, requirePlatformActor } from "@/lib/rbac/service";
import {
  getSettings,
  getSystemSetting,
  setOrganizationSetting,
} from "@/lib/settings/service";
import {
  currencyInputSchema,
  currencyToggleSchema,
  manualRateSchema,
  masterActiveSchema,
  type CurrencyInput,
} from "@/lib/validations/platform";
import type { ActionState } from "@/types";
import type { CurrencyRow } from "@/types/platform";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { queryCurrencies } from "./queries";

const MASTERS_PATH = "/settings/masters";
const PLATFORM_MASTERS_PATH = "/super-admin/masters";

/**
 * Exchange rates live in one platform-wide table. In SaaS mode a tenant must not
 * change rates other tenants convert with, so manual rates and provider refreshes
 * additionally need the platform-only `masters:manage_global`.
 */
function fxWritePermission(): PermissionKey[] {
  return isSaas()
    ? ["masters:manage", "masters:manage_global"]
    : ["masters:manage"];
}

function revalidateMasters() {
  revalidatePath(MASTERS_PATH);
  revalidatePath(PLATFORM_MASTERS_PATH);
}

async function _listCurrencies(
  options: { includeInactive?: boolean } = {}
): Promise<ActionState<CurrencyRow[]>> {
  try {
    const { organizationId } = await requirePlatformActor("masters:read");
    return {
      success: true,
      data: await queryCurrencies(organizationId, {
        includeInactive: Boolean(options.includeInactive),
      }),
    };
  } catch (error) {
    return toActionError(error, "listCurrencies");
  }
}
export const listCurrencies = withLogging("listCurrencies", _listCurrencies);

async function _setCurrencyEnabled(
  input: unknown
): Promise<ActionState<{ enabledCurrencies: string[] }>> {
  try {
    const { organizationId, userId } =
      await requirePermission("masters:manage");
    const { code, enabled } = currencyToggleSchema.parse(input);
    const s = await getSettings(organizationId, [
      "finance.baseCurrency",
      "finance.enabledCurrencies",
    ]);
    if (code === s["finance.baseCurrency"] && !enabled) {
      throw new ActionError("The base currency cannot be disabled");
    }
    const current = new Set(s["finance.enabledCurrencies"]);
    if (enabled) current.add(code);
    else current.delete(code);
    const next = Array.from(current);
    await setOrganizationSetting(
      organizationId,
      "finance.enabledCurrencies",
      next,
      userId
    );
    await writeAudit({
      organizationId,
      userId,
      action: enabled ? "ENABLE_CURRENCY" : "DISABLE_CURRENCY",
      entityType: "Currency",
      entityId: code,
      changes: { from: s["finance.enabledCurrencies"], to: next },
    });
    revalidateMasters();
    return { success: true, data: { enabledCurrencies: next } };
  } catch (error) {
    return toActionError(error, "setCurrencyEnabled");
  }
}
export const setCurrencyEnabled = withLogging(
  "setCurrencyEnabled",
  _setCurrencyEnabled
);

async function _refreshRatesNow(): Promise<ActionState<RefreshResult>> {
  try {
    const { organizationId, userId } =
      await requirePermission(fxWritePermission());
    const result = await refreshExchangeRates(organizationId);
    await writeAudit({
      organizationId,
      userId,
      action: "REFRESH_EXCHANGE_RATES",
      entityType: "ExchangeRate",
      metadata: {
        provider: result.provider,
        upserted: result.upserted,
        missing: result.missing,
      },
    });
    revalidateMasters();
    return { success: true, data: result };
  } catch (error) {
    return toActionError(error, "refreshRatesNow");
  }
}
export const refreshRatesNow = withLogging("refreshRatesNow", _refreshRatesNow);

async function _addManualRate(input: unknown): Promise<ActionState> {
  try {
    const { organizationId, userId } =
      await requirePermission(fxWritePermission());
    const parsed = manualRateSchema.parse(input);
    await setManualRate({
      baseCurrency: parsed.baseCurrency,
      quoteCurrency: parsed.quoteCurrency,
      rate: parsed.rate,
      asOf: parsed.asOf ? new Date(parsed.asOf) : undefined,
    });
    await writeAudit({
      organizationId,
      userId,
      action: "SET_MANUAL_RATE",
      entityType: "ExchangeRate",
      entityId: `${parsed.baseCurrency}-${parsed.quoteCurrency}`,
      changes: { rate: parsed.rate, asOf: parsed.asOf ?? null },
    });
    revalidateMasters();
    return { success: true };
  } catch (error) {
    return toActionError(error, "addManualRate");
  }
}
export const addManualRate = withLogging("addManualRate", _addManualRate);

// ─── Platform-wide currency master (masters:manage_global) ─────────────────

function currencyData(input: CurrencyInput) {
  return {
    name: input.name,
    symbol: input.symbol,
    decimalDigits: input.decimalDigits,
    numericCode: input.numericCode ?? null,
    sortOrder: input.sortOrder,
    isActive: input.isActive,
  };
}

/** Organisation base currency, or the platform default for a console caller. */
async function assertNotBaseCurrency(
  organizationId: string | null,
  code: string
): Promise<void> {
  const base = organizationId
    ? (await getSettings(organizationId, ["finance.baseCurrency"]))[
        "finance.baseCurrency"
      ]
    : await getSystemSetting("finance.baseCurrency");
  if (base === code) {
    throw new ActionError("The base currency cannot be deactivated");
  }
}

async function enableForOrganization(
  organizationId: string,
  userId: string,
  code: string
): Promise<void> {
  const s = await getSettings(organizationId, ["finance.enabledCurrencies"]);
  const current = s["finance.enabledCurrencies"];
  if (current.includes(code)) return;
  await setOrganizationSetting(
    organizationId,
    "finance.enabledCurrencies",
    [...current, code],
    userId
  );
}

async function _createCurrency(
  raw: unknown
): Promise<ActionState<{ code: string; enabled: boolean }>> {
  try {
    const actor = await requirePlatformActor("masters:manage_global");
    const { organizationId, userId, permissions } = actor;
    const input = currencyInputSchema.parse(raw);
    const existing = await prisma.currency.findUnique({
      where: { code: input.code },
    });
    if (existing) {
      throw new ActionError(`Currency ${input.code} already exists`);
    }
    await prisma.currency.create({
      data: { code: input.code, ...currencyData(input) },
    });
    const enable = Boolean(
      organizationId &&
      input.enableForOrganization &&
      input.isActive &&
      permissions.has("masters:manage")
    );
    if (enable && organizationId) {
      await enableForOrganization(organizationId, userId, input.code);
    }
    await auditPlatformChange(actor, {
      action: "CREATE_CURRENCY",
      entityType: "Currency",
      entityId: input.code,
      changes: { to: { ...currencyData(input), enabled: enable } },
    });
    revalidateMasters();
    return { success: true, data: { code: input.code, enabled: enable } };
  } catch (error) {
    return toActionError(error, "createCurrency");
  }
}
export const createCurrency = withLogging("createCurrency", _createCurrency);

async function _updateCurrency(
  code: string,
  raw: unknown
): Promise<ActionState> {
  try {
    const actor = await requirePlatformActor("masters:manage_global");
    const { organizationId } = actor;
    const input = currencyInputSchema.parse({
      ...(raw as Record<string, unknown>),
      code,
    });
    const existing = await prisma.currency.findUnique({
      where: { code: input.code },
    });
    if (!existing) throw new ActionError("Currency not found");
    if (!input.isActive) await assertNotBaseCurrency(organizationId, code);
    const data = currencyData(input);
    await prisma.currency.update({ where: { code: input.code }, data });
    await auditPlatformChange(actor, {
      action: "UPDATE_CURRENCY",
      entityType: "Currency",
      entityId: input.code,
      changes: diffRecords(
        {
          name: existing.name,
          symbol: existing.symbol,
          decimalDigits: existing.decimalDigits,
          numericCode: existing.numericCode,
          sortOrder: existing.sortOrder,
          isActive: existing.isActive,
        },
        data
      ) as Prisma.InputJsonValue,
    });
    revalidateMasters();
    return { success: true };
  } catch (error) {
    return toActionError(error, "updateCurrency");
  }
}
export const updateCurrency = withLogging("updateCurrency", _updateCurrency);

async function _setCurrencyActive(raw: unknown): Promise<ActionState> {
  try {
    const actor = await requirePlatformActor("masters:manage_global");
    const { organizationId } = actor;
    const { code, isActive } = masterActiveSchema.parse(raw);
    const existing = await prisma.currency.findUnique({ where: { code } });
    if (!existing) throw new ActionError("Currency not found");
    if (!isActive) await assertNotBaseCurrency(organizationId, code);
    await prisma.currency.update({ where: { code }, data: { isActive } });
    await auditPlatformChange(actor, {
      action: isActive ? "ACTIVATE_CURRENCY" : "DEACTIVATE_CURRENCY",
      entityType: "Currency",
      entityId: code,
      changes: { isActive: { from: existing.isActive, to: isActive } },
    });
    revalidateMasters();
    return { success: true };
  } catch (error) {
    return toActionError(error, "setCurrencyActive");
  }
}
export const setCurrencyActive = withLogging(
  "setCurrencyActive",
  _setCurrencyActive
);
