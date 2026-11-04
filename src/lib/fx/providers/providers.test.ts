import { describe, expect, it, vi } from "vitest";
import { createExchangerateHostProvider } from "./exchangerate-host";
import { createFrankfurterProvider } from "./frankfurter";
import {
  createGoogleFinanceProvider,
  parseGoogleFinancePrice,
} from "./google-finance";
import { getFxProvider } from "./index";
import { createOpenErApiProvider } from "./open-er-api";

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe("fx providers", () => {
  it("frankfurter maps rates and the ECB date", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        base: "USD",
        date: "2026-11-03",
        rates: { AED: 3.67, EUR: 0.92 },
      })
    );
    const quotes = await createFrankfurterProvider({ fetchImpl }).fetchRates(
      "USD",
      ["AED", "EUR", "USD"]
    );
    expect(quotes).toHaveLength(2);
    expect(quotes[0]).toMatchObject({ quote: "AED", rate: 3.67 });
    expect(quotes[0].asOf.toISOString()).toBe("2026-11-03T00:00:00.000Z");
    expect(String(fetchImpl.mock.calls[0][0])).toContain("to=AED,EUR");
  });

  it("open_er_api filters to the requested quotes and uses the update timestamp", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        result: "success",
        time_last_update_unix: 1762128000,
        rates: { AED: 3.6725, SAR: 3.75, XYZ: 9 },
      })
    );
    const quotes = await createOpenErApiProvider({ fetchImpl }).fetchRates(
      "USD",
      ["aed", "SAR"]
    );
    expect(quotes.map((q) => q.quote).sort()).toEqual(["AED", "SAR"]);
    expect(quotes[0].asOf.getTime()).toBe(1762128000 * 1000);
  });

  it("open_er_api throws on error payloads and HTTP failures", async () => {
    const bad = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ result: "error", "error-type": "quota" })
      );
    await expect(
      createOpenErApiProvider({ fetchImpl: bad }).fetchRates("USD", ["AED"])
    ).rejects.toThrow(/quota/);
    const http = vi.fn().mockResolvedValue(jsonResponse({}, false, 503));
    await expect(
      createOpenErApiProvider({ fetchImpl: http }).fetchRates("USD", ["AED"])
    ).rejects.toThrow(/503/);
  });

  it("exchangerate_host requires a key and strips the source prefix", async () => {
    await expect(
      createExchangerateHostProvider().fetchRates("USD", ["AED"])
    ).rejects.toThrow(/API key/);
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        timestamp: 1762128000,
        source: "USD",
        quotes: { USDAED: 3.67 },
      })
    );
    const quotes = await createExchangerateHostProvider({
      apiKey: "k",
      fetchImpl,
    }).fetchRates("USD", ["AED"]);
    expect(quotes).toEqual([
      { quote: "AED", rate: 3.67, asOf: new Date(1762128000 * 1000) },
    ]);
  });

  it("google_finance parses data-last-price and swallows failures", async () => {
    expect(parseGoogleFinancePrice('<div data-last-price="3.6725" ')).toBe(
      3.6725
    );
    expect(parseGoogleFinancePrice("<div>")).toBeNull();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => 'x data-last-price="3.67" y',
      } as unknown as Response)
      .mockRejectedValueOnce(new Error("blocked"));
    const quotes = await createGoogleFinanceProvider({ fetchImpl }).fetchRates(
      "USD",
      ["AED", "SAR"]
    );
    expect(quotes).toHaveLength(1);
    expect(quotes[0]).toMatchObject({ quote: "AED", rate: 3.67 });
  });

  it("manual provider returns nothing and the factory resolves every id", async () => {
    expect(await getFxProvider("manual").fetchRates("USD", ["AED"])).toEqual(
      []
    );
    for (const id of [
      "frankfurter",
      "open_er_api",
      "exchangerate_host",
      "google_finance",
    ] as const) {
      expect(getFxProvider(id).id).toBe(id);
    }
  });
});
