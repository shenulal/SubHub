// src/actions/platform/masters/global-masters.test.ts
import { prisma } from "@/lib/db";
import { ForbiddenError, requirePermission } from "@/lib/rbac/service";
import { getSettings, setOrganizationSetting } from "@/lib/settings/service";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCountry, setCountryActive, updateCountry } from "./countries";
import {
  createCurrency,
  setCurrencyActive,
  updateCurrency,
} from "./currencies";

vi.mock("@/lib/db", () => ({
  prisma: {
    currency: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    country: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));
vi.mock("@/lib/auth/require-auth", () => ({ getCachedSession: vi.fn() }));
vi.mock("@/lib/rbac/service", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/rbac/service")>(
      "@/lib/rbac/service"
    );
  return { ...actual, requirePermission: vi.fn() };
});
vi.mock("@/lib/settings/service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/settings/service")>(
    "@/lib/settings/service"
  );
  return {
    ...actual,
    getSettings: vi.fn(),
    setOrganizationSetting: vi.fn(),
  };
});
vi.mock("@/lib/fx/refresh", () => ({
  refreshExchangeRates: vi.fn(),
  setManualRate: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const rp = vi.mocked(requirePermission);
const settings = vi.mocked(getSettings);
const ctx = (perms: string[] = ["masters:manage_global", "masters:manage"]) =>
  ({
    organizationId: "org-1",
    userId: "u-1",
    role: "ADMIN",
    permissions: new Set(perms),
  }) as never;

const AED = {
  code: "AED",
  name: "UAE Dirham",
  symbol: "د.إ",
  decimalDigits: 2,
};

beforeEach(() => {
  vi.clearAllMocks();
  rp.mockResolvedValue(ctx());
  settings.mockResolvedValue({
    "finance.baseCurrency": "AED",
    "finance.enabledCurrencies": ["AED", "USD"],
    "general.countryCode": "AE",
  } as never);
});

describe("currency master", () => {
  it("denies create without masters:manage_global", async () => {
    rp.mockRejectedValue(new ForbiddenError("masters:manage_global"));
    const result = await createCurrency({ ...AED, code: "XAU" });
    expect(result.success).toBe(false);
    expect(rp).toHaveBeenCalledWith("masters:manage_global");
    expect(prisma.currency.create).not.toHaveBeenCalled();
  });

  it("creates a currency, enables it for the organisation and audits", async () => {
    vi.mocked(prisma.currency.findUnique).mockResolvedValue(null);
    const result = await createCurrency({
      code: "omr",
      name: "Omani Rial",
      symbol: "ر.ع.",
      decimalDigits: 3,
      enableForOrganization: true,
    });
    expect(result).toMatchObject({
      success: true,
      data: { code: "OMR", enabled: true },
    });
    expect(prisma.currency.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ code: "OMR", decimalDigits: 3 }),
    });
    expect(setOrganizationSetting).toHaveBeenCalledWith(
      "org-1",
      "finance.enabledCurrencies",
      ["AED", "USD", "OMR"],
      "u-1"
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "CREATE_CURRENCY" }),
    });
  });

  it("does not enable for the organisation without masters:manage", async () => {
    rp.mockResolvedValue(ctx(["masters:manage_global"]));
    vi.mocked(prisma.currency.findUnique).mockResolvedValue(null);
    const result = await createCurrency({
      ...AED,
      code: "BHD",
      enableForOrganization: true,
    });
    expect(result.data?.enabled).toBe(false);
    expect(setOrganizationSetting).not.toHaveBeenCalled();
  });

  it("rejects a duplicate code", async () => {
    vi.mocked(prisma.currency.findUnique).mockResolvedValue(AED as never);
    const result = await createCurrency(AED);
    expect(result).toMatchObject({ success: false });
    expect(result.error).toMatch(/already exists/);
  });

  it("updates an existing currency", async () => {
    vi.mocked(prisma.currency.findUnique).mockResolvedValue({
      ...AED,
      numericCode: "784",
      sortOrder: 1,
      isActive: true,
    } as never);
    const result = await updateCurrency("AED", { ...AED, symbol: "AED" });
    expect(result.success).toBe(true);
    expect(prisma.currency.update).toHaveBeenCalledWith({
      where: { code: "AED" },
      data: expect.objectContaining({ symbol: "AED" }),
    });
  });

  it("refuses to deactivate the organisation base currency", async () => {
    vi.mocked(prisma.currency.findUnique).mockResolvedValue(AED as never);
    const result = await setCurrencyActive({ code: "AED", isActive: false });
    expect(result.success).toBe(false);
    expect(prisma.currency.update).not.toHaveBeenCalled();
  });

  it("deactivates another currency", async () => {
    vi.mocked(prisma.currency.findUnique).mockResolvedValue({
      ...AED,
      code: "USD",
      isActive: true,
    } as never);
    const result = await setCurrencyActive({ code: "USD", isActive: false });
    expect(result.success).toBe(true);
    expect(prisma.currency.update).toHaveBeenCalledWith({
      where: { code: "USD" },
      data: { isActive: false },
    });
  });
});

describe("country master", () => {
  const SA = {
    code: "sa",
    name: "Saudi Arabia",
    region: "GCC",
    currencyCode: "SAR",
    defaultTaxRatePercent: 15,
    phonePrefix: "+966",
  };

  it("denies create without masters:manage_global", async () => {
    rp.mockRejectedValue(new ForbiddenError("masters:manage_global"));
    const result = await createCountry(SA);
    expect(result.success).toBe(false);
    expect(prisma.country.create).not.toHaveBeenCalled();
  });

  it("creates a country after checking the currency master", async () => {
    vi.mocked(prisma.country.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.currency.findUnique).mockResolvedValue({
      code: "SAR",
    } as never);
    const result = await createCountry(SA);
    expect(result).toMatchObject({ success: true, data: { code: "SA" } });
    expect(prisma.country.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        code: "SA",
        currencyCode: "SAR",
        defaultTaxRatePercent: 15,
      }),
    });
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it("rejects an unknown currency", async () => {
    vi.mocked(prisma.country.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.currency.findUnique).mockResolvedValue(null);
    const result = await createCountry(SA);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/currency master/);
  });

  it("validates the phone prefix", async () => {
    const result = await createCountry({ ...SA, phonePrefix: "966" });
    expect(result.success).toBe(false);
    expect(result.errors?.phonePrefix).toBeDefined();
  });

  it("updates and refuses to deactivate the organisation country", async () => {
    vi.mocked(prisma.country.findUnique).mockResolvedValue({
      code: "AE",
      name: "United Arab Emirates",
      region: "GCC",
      currencyCode: null,
      defaultTaxRatePercent: null,
      phonePrefix: "+971",
      isActive: true,
    } as never);
    const ok = await updateCountry("AE", {
      name: "UAE",
      phonePrefix: "+971",
    });
    expect(ok.success).toBe(true);
    const blocked = await setCountryActive({ code: "AE", isActive: false });
    expect(blocked.success).toBe(false);
  });
});
