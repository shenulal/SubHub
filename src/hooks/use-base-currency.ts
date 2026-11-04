"use client";

import { formatMoney } from "@/lib/fx/convert";
import { SETTING_DEFINITIONS } from "@/lib/settings/registry";
import type { MeContext } from "@/types/platform";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

interface MeContextResponse {
  success: boolean;
  data?: MeContext;
}

export const FALLBACK_ME_CONTEXT: MeContext = {
  baseCurrency: SETTING_DEFINITIONS["finance.baseCurrency"].defaultValue,
  enabledCurrencies:
    SETTING_DEFINITIONS["finance.enabledCurrencies"].defaultValue,
  locale: SETTING_DEFINITIONS["general.locale"].defaultValue,
  timezone: SETTING_DEFINITIONS["general.timezone"].defaultValue,
  dateFormat: SETTING_DEFINITIONS["general.dateFormat"].defaultValue,
  roundingDecimals:
    SETTING_DEFINITIONS["finance.roundingDecimals"].defaultValue,
};

const STALE_TIME_MS = 5 * 60_000;

async function fetchMeContext(): Promise<MeContext> {
  const res = await fetch("/api/v1/me/context", { credentials: "include" });
  if (!res.ok) return FALLBACK_ME_CONTEXT;
  const json = (await res.json()) as MeContextResponse;
  return json.data ?? FALLBACK_ME_CONTEXT;
}

/**
 * Organisation base currency + locale context for client components.
 * `format(amount, currency?)` formats in the base currency unless told otherwise.
 */
export function useBaseCurrency() {
  const query = useQuery({
    queryKey: ["me", "context"],
    queryFn: fetchMeContext,
    staleTime: STALE_TIME_MS,
  });
  const context = query.data ?? FALLBACK_ME_CONTEXT;
  const format = useCallback(
    (amount: number, currency?: string, decimals?: number) =>
      formatMoney(
        amount,
        currency ?? context.baseCurrency,
        context.locale,
        decimals
      ),
    [context.baseCurrency, context.locale]
  );
  return {
    ...context,
    format,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
