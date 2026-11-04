// src/lib/fx/providers/frankfurter.ts
import {
  fetchJson,
  normalizeCodes,
  type FxProvider,
  type FxProviderOptions,
  type FxQuote,
} from "./types";

const ENDPOINT = "https://api.frankfurter.app/latest";

interface FrankfurterResponse {
  base: string;
  date: string;
  rates: Record<string, number>;
}

/** European Central Bank reference rates (free, ~30 major currencies). */
export function createFrankfurterProvider(
  options: FxProviderOptions = {}
): FxProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    id: "frankfurter",
    async fetchRates(base, quotes): Promise<FxQuote[]> {
      const wanted = normalizeCodes(quotes).filter((q) => q !== base);
      if (wanted.length === 0) return [];
      const url = `${ENDPOINT}?from=${encodeURIComponent(base)}&to=${wanted.join(",")}`;
      const json = await fetchJson<FrankfurterResponse>(
        fetchImpl,
        url,
        "frankfurter"
      );
      const asOf = new Date(`${json.date}T00:00:00.000Z`);
      return Object.entries(json.rates ?? {})
        .filter(([code, rate]) => wanted.includes(code) && rate > 0)
        .map(([quote, rate]) => ({ quote, rate, asOf }));
    },
  };
}
