// src/actions/platform/masters/currencies.ts
"use server";

import {
  ActionError,
  toActionError,
  writeAudit,
} from "@/actions/platform/_shared";
import {
  refreshExchangeRates,
  setManualRate,
  type RefreshResult,
} from "@/lib/fx/refresh";
import { withLogging } from "@/lib/logging";
import { requirePermission } from "@/lib/rbac/service";
import { getSettings, setOrganizationSetting } from "@/lib/settings/service";
import {
  currencyToggleSchema,
  manualRateSchema,
} from "@/lib/validations/platform";
import type { ActionState } from "@/types";
import type { CurrencyRow } from "@/types/platform";
import { revalidatePath } from "next/cache";
import { queryCurrencies } from "./queries";

const MASTERS_PATH = "/settings/masters";

async function _listCurrencies(): Promise<ActionState<CurrencyRow[]>> {
  try {
    const { organizationId } = await requirePermission("masters:read");
    return { success: true, data: await queryCurrencies(organizationId) };
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
    revalidatePath(MASTERS_PATH);
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
      await requirePermission("masters:manage");
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
    revalidatePath(MASTERS_PATH);
    return { success: true, data: result };
  } catch (error) {
    return toActionError(error, "refreshRatesNow");
  }
}
export const refreshRatesNow = withLogging("refreshRatesNow", _refreshRatesNow);

async function _addManualRate(input: unknown): Promise<ActionState> {
  try {
    const { organizationId, userId } =
      await requirePermission("masters:manage");
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
    revalidatePath(MASTERS_PATH);
    return { success: true };
  } catch (error) {
    return toActionError(error, "addManualRate");
  }
}
export const addManualRate = withLogging("addManualRate", _addManualRate);
