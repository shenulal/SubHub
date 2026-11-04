// src/lib/fx/providers/index.ts
import { createExchangerateHostProvider } from "./exchangerate-host";
import { createFrankfurterProvider } from "./frankfurter";
import { createGoogleFinanceProvider } from "./google-finance";
import { manualProvider } from "./manual";
import { createOpenErApiProvider } from "./open-er-api";
import type { FxProvider, FxProviderId, FxProviderOptions } from "./types";

export * from "./types";
export {
  createExchangerateHostProvider,
  createFrankfurterProvider,
  createGoogleFinanceProvider,
  createOpenErApiProvider,
  manualProvider,
};

/** Provider used to fill gaps left by best-effort providers. */
export const FALLBACK_PROVIDER_ID: FxProviderId = "open_er_api";

export function getFxProvider(
  id: FxProviderId,
  options: FxProviderOptions = {}
): FxProvider {
  switch (id) {
    case "manual":
      return manualProvider;
    case "frankfurter":
      return createFrankfurterProvider(options);
    case "open_er_api":
      return createOpenErApiProvider(options);
    case "exchangerate_host":
      return createExchangerateHostProvider(options);
    case "google_finance":
      return createGoogleFinanceProvider(options);
    default: {
      const exhaustive: never = id;
      throw new Error(`Unknown FX provider: ${String(exhaustive)}`);
    }
  }
}
