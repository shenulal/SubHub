import { beforeEach, describe, expect, it, vi } from "vitest";

import { MockForbiddenError, deny, grant } from "./test-utils";

vi.mock("@/lib/db", () => ({
  prisma: {
    saaSCatalog: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    app: { findFirst: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));
vi.mock("@/lib/auth/require-auth", () => ({ requireOrganization: vi.fn() }));
vi.mock("@/lib/rbac/service", () => ({
  ForbiddenError: MockForbiddenError,
  isForbiddenError: (e: unknown) => e instanceof MockForbiddenError,
  requirePermission: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));
vi.mock("@/lib/logging", () => ({
  withLogging: (_n: string, fn: unknown) => fn,
}));

import { requireOrganization } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/service";

import {
  getCatalogItem,
  searchCatalog,
  setAppCancellationOverride,
  updateCatalogItem,
} from "./catalog";

const rp = vi.mocked(requirePermission);
const ro = vi.mocked(requireOrganization);
const db = prisma as unknown as {
  saaSCatalog: Record<string, ReturnType<typeof vi.fn>>;
  app: Record<string, ReturnType<typeof vi.fn>>;
  auditLog: { create: ReturnType<typeof vi.fn> };
  $queryRaw: ReturnType<typeof vi.fn>;
};
const item = (over: Record<string, unknown>) => ({
  id: "i",
  name: "Slack",
  slug: "slack",
  category: "Software",
  subcategory: "Communication & Collaboration",
  description: null,
  logoUrl: null,
  website: null,
  vendorName: null,
  pricingModel: "PER_SEAT",
  basePricePerSeat: { toNumber: () => 8.75 },
  basePriceCurrency: "USD",
  aliases: ["slack.com"],
  cancellationUrl: null,
  billingPortalUrl: null,
  cancellationSteps: ["a", 2],
  noticePeriodDays: null,
  countryCode: null,
  isActive: true,
  ...over,
});

beforeEach(() => {
  vi.resetAllMocks();
  ro.mockResolvedValue({ organizationId: "org-1", userId: "u" } as never);
});

describe("searchCatalog", () => {
  it("returns [] for a blank query without hitting the DB", async () => {
    expect(await searchCatalog("  ")).toEqual([]);
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
  it("ranks DB candidates (prefix before contains) and maps DTOs", async () => {
    db.$queryRaw.mockResolvedValue([{ id: "1" }, { id: "2" }]);
    db.saaSCatalog.findMany.mockResolvedValue([
      item({
        id: "1",
        name: "Microsoft Teams",
        aliases: ["slack alternative"],
      }),
      item({ id: "2", name: "Slack" }),
    ]);
    const result = await searchCatalog("sla", 5);
    expect(result.map((r) => r.name)).toEqual(["Slack", "Microsoft Teams"]);
    expect(result[0]).toMatchObject({
      basePricePerSeat: 8.75,
      cancellationSteps: ["a"],
    });
    expect(db.saaSCatalog.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["1", "2"] } },
    });
  });
  it("returns [] when no candidate matches", async () => {
    db.$queryRaw.mockResolvedValue([]);
    expect(await searchCatalog("zzz")).toEqual([]);
  });
});

describe("getCatalogItem", () => {
  it("maps a row or returns null", async () => {
    db.saaSCatalog.findUnique
      .mockResolvedValueOnce(item({}))
      .mockResolvedValueOnce(null);
    expect((await getCatalogItem("i"))?.slug).toBe("slack");
    expect(await getCatalogItem("x")).toBeNull();
  });
});

describe("updateCatalogItem", () => {
  it("requires catalog:manage", async () => {
    deny(rp);
    expect((await updateCatalogItem("i", {})).success).toBe(false);
  });
  it("validates URLs and persists the guide with an audit entry", async () => {
    grant(rp);
    expect(
      (await updateCatalogItem("i", { cancellationUrl: "not-a-url" })).errors
        ?.cancellationUrl
    ).toBeTruthy();
    db.saaSCatalog.findUnique.mockResolvedValue(item({}));
    db.saaSCatalog.update.mockResolvedValue(
      item({ cancellationSteps: ["x", "y", "z"], noticePeriodDays: 30 })
    );
    const result = await updateCatalogItem("i", {
      cancellationSteps: ["x", "y", "z"],
      noticePeriodDays: 30,
      billingPortalUrl: null,
    });
    expect(result.data?.noticePeriodDays).toBe(30);
    expect(db.saaSCatalog.update.mock.calls[0][0].data).toEqual({
      cancellationSteps: ["x", "y", "z"],
      noticePeriodDays: 30,
      billingPortalUrl: null,
    });
    expect(db.auditLog.create.mock.calls[0][0].data.action).toBe(
      "UPDATE_CATALOG_ITEM"
    );
  });
});

describe("setAppCancellationOverride", () => {
  it("scopes the app to the organisation", async () => {
    grant(rp);
    db.app.findFirst.mockResolvedValue(null);
    expect(
      (await setAppCancellationOverride("a", { cancellationNotes: "x" })).error
    ).toMatch(/not found/);
    expect(db.app.findFirst.mock.calls[0][0].where).toEqual({
      id: "a",
      organizationId: "org-1",
    });
  });
  it("stores the override", async () => {
    grant(rp);
    db.app.findFirst.mockResolvedValue({ id: "a" });
    db.app.update.mockResolvedValue({
      cancellationUrl: "https://x.io/cancel",
      cancellationNotes: "Call IT",
    });
    const result = await setAppCancellationOverride("a", {
      cancellationUrl: "https://x.io/cancel",
      cancellationNotes: "Call IT",
    });
    expect(result.data).toEqual({
      cancellationUrl: "https://x.io/cancel",
      cancellationNotes: "Call IT",
    });
  });
});
