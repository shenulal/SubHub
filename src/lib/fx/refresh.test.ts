import { prisma } from "@/lib/db";
import { getSettings, getSystemSetting } from "@/lib/settings/service";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFxProvider } from "./providers";
import {
  collectQuoteCurrencies,
  refreshExchangeRates,
  setManualRate,
  truncateToDay,
} from "./refresh";

vi.mock("@/lib/db", () => ({
  prisma: {
    organization: { findMany: vi.fn() },
    organizationSetting: { findUnique: vi.fn() },
    exchangeRate: { upsert: vi.fn() },
  },
}));
vi.mock("@/lib/settings/service", () => ({
  getSettings: vi.fn(),
  getSystemSetting: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));
vi.mock("./providers", async () => {
  const actual =
    await vi.importActual<typeof import("./providers")>("./providers");
  return { ...actual, getFxProvider: vi.fn() };
});

const mockedProvider = getFxProvider as unknown as ReturnType<typeof vi.fn>;
const mockedSettings = getSettings as unknown as ReturnType<typeof vi.fn>;
const mockedSystem = getSystemSetting as unknown as ReturnType<typeof vi.fn>;
const upsert = prisma.exchangeRate.upsert as unknown as ReturnType<
  typeof vi.fn
>;
const orgs = prisma.organization.findMany as unknown as ReturnType<
  typeof vi.fn
>;
const override = prisma.organizationSetting.findUnique as unknown as ReturnType<
  typeof vi.fn
>;

const DAY = new Date("2026-11-03T15:42:00Z");

describe("refreshExchangeRates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    orgs.mockResolvedValue([{ id: "org-1" }, { id: "org-2" }]);
    override.mockResolvedValue(null);
    mockedSystem.mockResolvedValue("frankfurter");
    mockedSettings.mockImplementation(async (orgId: string) => ({
      "finance.baseCurrency": orgId === "org-1" ? "AED" : "SAR",
      "finance.enabledCurrencies": ["USD", "EUR"],
      "finance.fxProvider": "google_finance",
      "finance.fxApiKey": "",
    }));
  });

  it("truncates provider dates to UTC midnight", () => {
    expect(truncateToDay(DAY).toISOString()).toBe("2026-11-03T00:00:00.000Z");
  });

  it("collects the union of base and enabled currencies minus the pivot", async () => {
    expect(await collectQuoteCurrencies()).toEqual(["AED", "EUR", "SAR"]);
    expect(await collectQuoteCurrencies("org-2")).toEqual(["EUR", "SAR"]);
  });

  it("upserts fetched rates using the system default provider", async () => {
    mockedProvider.mockReturnValue({
      id: "frankfurter",
      fetchRates: vi.fn().mockResolvedValue([
        { quote: "AED", rate: 3.67, asOf: DAY },
        { quote: "EUR", rate: 0.92, asOf: DAY },
        { quote: "SAR", rate: 3.75, asOf: DAY },
      ]),
    });
    const result = await refreshExchangeRates();
    expect(result).toMatchObject({
      provider: "frankfurter",
      upserted: 3,
      missing: [],
    });
    expect(upsert).toHaveBeenCalledTimes(3);
    const call = upsert.mock.calls[0][0];
    expect(call.where.baseCurrency_quoteCurrency_asOf.asOf.toISOString()).toBe(
      "2026-11-03T00:00:00.000Z"
    );
    expect(call.create).toMatchObject({
      source: "api",
      provider: "frankfurter",
    });
  });

  it("uses the organisation override and fills gaps from the fallback provider", async () => {
    override.mockResolvedValue({ value: "google_finance" });
    const google = {
      id: "google_finance",
      fetchRates: vi
        .fn()
        .mockResolvedValue([{ quote: "EUR", rate: 0.9, asOf: DAY }]),
    };
    const fallback = {
      id: "open_er_api",
      fetchRates: vi
        .fn()
        .mockResolvedValue([{ quote: "SAR", rate: 3.75, asOf: DAY }]),
    };
    mockedProvider.mockImplementation((id: string) =>
      id === "google_finance" ? google : fallback
    );

    const result = await refreshExchangeRates("org-2");
    expect(google.fetchRates).toHaveBeenCalledWith("USD", ["EUR", "SAR"]);
    expect(fallback.fetchRates).toHaveBeenCalledWith("USD", ["SAR"]);
    expect(result).toMatchObject({
      provider: "google_finance",
      upserted: 2,
      missing: [],
    });
  });

  it("skips fetching when the provider is manual", async () => {
    mockedSystem.mockResolvedValue("manual");
    const result = await refreshExchangeRates();
    expect(result.upserted).toBe(0);
    expect(mockedProvider).not.toHaveBeenCalled();
  });

  it("survives a provider failure and reports the missing quotes", async () => {
    mockedSystem.mockResolvedValue("open_er_api");
    mockedProvider.mockReturnValue({
      id: "open_er_api",
      fetchRates: vi.fn().mockRejectedValue(new Error("down")),
    });
    const result = await refreshExchangeRates("org-1");
    expect(result.upserted).toBe(0);
    expect(result.missing).toEqual(["AED", "EUR"]);
  });
});

describe("setManualRate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects identical currencies and non-positive rates", async () => {
    await expect(
      setManualRate({ baseCurrency: "USD", quoteCurrency: "usd", rate: 1 })
    ).rejects.toThrow(/differ/);
    await expect(
      setManualRate({ baseCurrency: "USD", quoteCurrency: "AED", rate: 0 })
    ).rejects.toThrow(/positive/);
  });

  it("stores a manual rate with source manual and no provider", async () => {
    await setManualRate({
      baseCurrency: "usd",
      quoteCurrency: "aed",
      rate: 3.6725,
      asOf: DAY,
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          baseCurrency: "USD",
          quoteCurrency: "AED",
          source: "manual",
          provider: null,
        }),
      })
    );
  });
});
