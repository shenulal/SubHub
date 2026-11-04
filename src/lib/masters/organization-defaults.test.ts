// src/lib/masters/organization-defaults.test.ts
import { prisma } from "@/lib/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_BILLING_CYCLES,
  DEFAULT_CATEGORY_TREE,
  DEFAULT_PAYMENT_METHODS,
  ensureBillingCycleConfigs,
  ensureDefaultCategories,
  ensureDefaultPaymentMethods,
  ensureDefaultTaxRate,
  ensureOrganizationDefaults,
} from "./organization-defaults";

vi.mock("@/lib/db", () => ({
  prisma: {
    category: { count: vi.fn(), create: vi.fn() },
    paymentMethodOption: { count: vi.fn(), createMany: vi.fn() },
    billingCycleConfig: { upsert: vi.fn() },
    taxRate: { count: vi.fn(), create: vi.fn() },
    country: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/rbac/service", () => ({ ensureOrganizationRoles: vi.fn() }));
vi.mock("@/lib/settings/service", () => ({
  getSetting: vi.fn().mockResolvedValue("AE"),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

describe("organisation default masters", () => {
  beforeEach(() => vi.clearAllMocks());

  it("seeds the two-level category tree once", async () => {
    db.category.count.mockResolvedValue(0);
    db.category.create.mockImplementation(
      async ({ data }: { data: { slug: string } }) => ({ id: `c-${data.slug}` })
    );
    await ensureDefaultCategories("org");
    const children = DEFAULT_CATEGORY_TREE.reduce(
      (n, t) => n + t.children.length,
      0
    );
    expect(db.category.create).toHaveBeenCalledTimes(
      DEFAULT_CATEGORY_TREE.length + children
    );
    const childCall = db.category.create.mock.calls.find(
      (c: [{ data: { parentId?: string } }]) =>
        c[0].data.parentId === "c-software"
    );
    expect(childCall).toBeTruthy();
    db.category.count.mockResolvedValue(10);
    db.category.create.mockClear();
    await ensureDefaultCategories("org");
    expect(db.category.create).not.toHaveBeenCalled();
  });

  it("seeds payment methods with one default", async () => {
    db.paymentMethodOption.count.mockResolvedValue(0);
    await ensureDefaultPaymentMethods("org");
    const data = db.paymentMethodOption.createMany.mock.calls[0][0].data;
    expect(data).toHaveLength(DEFAULT_PAYMENT_METHODS.length);
    expect(
      data.filter((d: { isDefault: boolean }) => d.isDefault)
    ).toHaveLength(1);
  });

  it("upserts billing cycle configuration with months per cycle", async () => {
    await ensureBillingCycleConfigs("org");
    expect(db.billingCycleConfig.upsert).toHaveBeenCalledTimes(
      DEFAULT_BILLING_CYCLES.length
    );
    const yearly = db.billingCycleConfig.upsert.mock.calls.find(
      (c: [{ create: { cycle: string } }]) => c[0].create.cycle === "YEARLY"
    );
    expect(yearly[0].create.months).toBe(12);
  });

  it("derives the default tax rate from the country master", async () => {
    db.taxRate.count.mockResolvedValue(0);
    db.country.findUnique.mockResolvedValue({
      code: "AE",
      defaultTaxRatePercent: 5,
    });
    await ensureDefaultTaxRate("org", "AE");
    expect(db.taxRate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "VAT 5%",
          ratePercent: 5,
          isDefault: true,
        }),
      })
    );
    db.taxRate.create.mockClear();
    db.country.findUnique.mockResolvedValue(null);
    await ensureDefaultTaxRate("org", "ZZ");
    expect(db.taxRate.create.mock.calls[0][0].data.name).toBe("No tax");
  });

  it("ensureOrganizationDefaults runs every seeder with the configured country", async () => {
    db.category.count.mockResolvedValue(1);
    db.paymentMethodOption.count.mockResolvedValue(1);
    db.taxRate.count.mockResolvedValue(1);
    await ensureOrganizationDefaults("org");
    expect(db.billingCycleConfig.upsert).toHaveBeenCalled();
    expect(db.country.findUnique).not.toHaveBeenCalled();
  });
});
