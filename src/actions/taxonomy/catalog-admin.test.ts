// src/actions/taxonomy/catalog-admin.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MockForbiddenError, deny, grant } from "./test-utils";

vi.mock("@/lib/db", () => ({
  prisma: {
    saaSCatalog: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    currency: { findUnique: vi.fn() },
    country: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));
vi.mock("@/lib/rbac/service", () => {
  const requirePermission = vi.fn();
  return {
    ForbiddenError: MockForbiddenError,
    isForbiddenError: (e: unknown) => e instanceof MockForbiddenError,
    requirePermission,
    // Platform-wide catalog writes go through requirePlatformActor, which defers
    // to requirePermission for tenant users.
    requirePlatformActor: (...args: unknown[]) => requirePermission(...args),
  };
});
vi.mock("@/lib/settings/service", () => ({
  getSetting: vi.fn().mockResolvedValue(20),
  getSystemSetting: vi.fn().mockResolvedValue(20),
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));
vi.mock("@/lib/logging", () => ({
  withLogging: (_n: string, fn: unknown) => fn,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/service";

import {
  createCatalogEntry,
  editCatalogEntry,
  listCatalogEntries,
  setCatalogEntryActive,
} from "./catalog-admin";

const rp = vi.mocked(requirePermission);
const db = prisma as unknown as {
  saaSCatalog: Record<string, ReturnType<typeof vi.fn>>;
  currency: { findUnique: ReturnType<typeof vi.fn> };
  country: { findUnique: ReturnType<typeof vi.fn> };
  auditLog: { create: ReturnType<typeof vi.fn> };
};
const row = (over: Record<string, unknown> = {}) => ({
  id: "c1",
  name: "Zoho Books",
  slug: "zoho-books",
  category: "Software",
  subcategory: null,
  description: null,
  logoUrl: null,
  website: "https://zoho.com",
  vendorName: "Zoho",
  pricingModel: "PER_SEAT",
  basePricePerSeat: { toNumber: () => 15 },
  basePriceCurrency: "AED",
  aliases: ["zoho"],
  cancellationUrl: null,
  billingPortalUrl: null,
  cancellationSteps: null,
  noticePeriodDays: 30,
  countryCode: "AE",
  isActive: true,
  ...over,
});
const input = {
  name: "Zoho Books",
  vendorName: "Zoho",
  category: "Software",
  website: "https://zoho.com",
  pricingModel: "PER_SEAT" as const,
  basePricePerSeat: 15,
  basePriceCurrency: "AED",
  aliases: ["zoho", "zoho"],
  noticePeriodDays: 30,
  countryCode: "AE",
};

beforeEach(() => {
  vi.clearAllMocks();
  grant(rp);
  db.currency.findUnique.mockResolvedValue({ code: "AED" });
  db.country.findUnique.mockResolvedValue({ code: "AE" });
  db.saaSCatalog.findFirst.mockResolvedValue(null);
});

describe("listCatalogEntries", () => {
  it("returns a page with distinct categories", async () => {
    db.saaSCatalog.findMany
      .mockResolvedValueOnce([row()])
      .mockResolvedValueOnce([{ category: "Software" }]);
    db.saaSCatalog.count.mockResolvedValue(41);
    const result = await listCatalogEntries({ query: "zoho", page: 3 });
    expect(rp).toHaveBeenCalledWith("catalog:read");
    expect(result.data).toMatchObject({
      total: 41,
      page: 3,
      pageSize: 20,
      categories: ["Software"],
    });
    expect(db.saaSCatalog.findMany.mock.calls[0][0]).toMatchObject({
      skip: 40,
      take: 20,
    });
  });

  it("is denied without catalog:read", async () => {
    deny(rp);
    const result = await listCatalogEntries();
    expect(result.success).toBe(false);
  });
});

describe("createCatalogEntry", () => {
  it("is denied without catalog:manage", async () => {
    deny(rp);
    const result = await createCatalogEntry(input);
    expect(result.success).toBe(false);
    expect(db.saaSCatalog.create).not.toHaveBeenCalled();
  });

  it("creates with a unique slug, de-duplicated aliases and an audit row", async () => {
    db.saaSCatalog.findMany.mockResolvedValue([{ slug: "zoho-books" }]);
    db.saaSCatalog.create.mockResolvedValue(row({ slug: "zoho-books-2" }));
    const result = await createCatalogEntry(input);
    expect(rp).toHaveBeenCalledWith("catalog:manage");
    expect(result.success).toBe(true);
    expect(db.saaSCatalog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        slug: "zoho-books-2",
        aliases: ["zoho"],
        basePriceCurrency: "AED",
      }),
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "CREATE_CATALOG_ITEM" }),
    });
  });

  it("rejects a currency that is not in the master", async () => {
    db.currency.findUnique.mockResolvedValue(null);
    const result = await createCatalogEntry(input);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/currency master/);
  });

  it("rejects a duplicate name", async () => {
    db.saaSCatalog.findFirst.mockResolvedValue({ id: "other" });
    const result = await createCatalogEntry(input);
    expect(result.error).toMatch(/already exists/);
  });

  it("validates URLs", async () => {
    const result = await createCatalogEntry({ ...input, website: "nope" });
    expect(result.success).toBe(false);
    expect(result.errors?.website).toBeDefined();
  });
});

describe("editCatalogEntry / setCatalogEntryActive", () => {
  it("updates an entry", async () => {
    db.saaSCatalog.findUnique.mockResolvedValue(row());
    db.saaSCatalog.update.mockResolvedValue(row({ vendorName: "Zoho Corp" }));
    const result = await editCatalogEntry("c1", {
      ...input,
      vendorName: "Zoho Corp",
    });
    expect(result.success).toBe(true);
    expect(db.saaSCatalog.findFirst.mock.calls[0][0].where.id).toEqual({
      not: "c1",
    });
  });

  it("deactivates an entry", async () => {
    db.saaSCatalog.findUnique.mockResolvedValue(row());
    const result = await setCatalogEntryActive("c1", false);
    expect(result.success).toBe(true);
    expect(db.saaSCatalog.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { isActive: false },
    });
  });

  it("is denied without catalog:manage", async () => {
    deny(rp);
    const result = await setCatalogEntryActive("c1", false);
    expect(result.success).toBe(false);
    expect(db.saaSCatalog.update).not.toHaveBeenCalled();
  });
});
