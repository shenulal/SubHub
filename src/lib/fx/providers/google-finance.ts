// src/lib/fx/providers/google-finance.ts
/**
 * Google Finance has NO official FX API. This provider scrapes the public quote
 * page (`/finance/quote/USD-AED`) and reads the `data-last-price` attribute.
 * It is best-effort only: markup changes or rate limiting silently yield fewer
 * quotes, and `refreshExchangeRates` fills the gaps from `open_er_api`.
 */
import { logger } from "@/lib/logger";
import {
  FX_FETCH_TIMEOUT_MS,
  normalizeCodes,
  type FxProvider,
  type FxProviderOptions,
  type FxQuote,
} from "./types";

const ENDPOINT = "https://www.google.com/finance/quote";
const PRICE_ATTRIBUTE = /data-last-price="([0-9.]+)"/;
const USER_AGENT =
  "Mozilla/5.0 (compatible; SubHubFxBot/1.0; +https://subhub.app)";

export function parseGoogleFinancePrice(html: string): number | null {
  const match = PRICE_ATTRIBUTE.exec(html);
  if (!match) return null;
  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function createGoogleFinanceProvider(
  options: FxProviderOptions = {}
): FxProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  async function fetchOne(
    base: string,
    quote: string
  ): Promise<FxQuote | null> {
    try {
      const response = await fetchImpl(`${ENDPOINT}/${base}-${quote}`, {
        headers: { "user-agent": USER_AGENT, accept: "text/html" },
        signal: AbortSignal.timeout(FX_FETCH_TIMEOUT_MS),
      });
      if (!response.ok) return null;
      const rate = parseGoogleFinancePrice(await response.text());
      return rate ? { quote, rate, asOf: new Date() } : null;
    } catch (error) {
      logger.warn(
        { err: error, base, quote },
        "[fx:google_finance] quote fetch failed"
      );
      return null;
    }
  }
  return {
    id: "google_finance",
    async fetchRates(base, quotes): Promise<FxQuote[]> {
      const wanted = normalizeCodes(quotes).filter((q) => q !== base);
      const results = await Promise.all(wanted.map((q) => fetchOne(base, q)));
      return results.filter((r): r is FxQuote => r !== null);
    },
  };
}
