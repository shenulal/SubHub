// src/lib/licensing/licensing.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: { systemSetting: { findUnique: vi.fn(), upsert: vi.fn() } },
}));

import { prisma } from "@/lib/db";
import {
  checkLimit,
  evaluateLimit,
  getLicense,
  isLicenseExpired,
  resetLicenseProvider,
  setLicenseProvider,
  type License,
} from "./index";
import { getInstallationId, INSTALLATION_ID_KEY } from "./installation";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

beforeEach(() => {
  vi.clearAllMocks();
  db.systemSetting.findUnique.mockResolvedValue({ value: "inst-1" });
});
afterEach(() => resetLicenseProvider());

describe("community licence (default provider)", () => {
  it("is unlicensed, without limits or expiry, managed by HelloPixels", async () => {
    const license = await getLicense();
    expect(license).toMatchObject({
      edition: "community",
      status: "unlicensed",
      limits: { maxTenants: null, maxUsersPerTenant: null },
      expiresAt: null,
    });
    expect(license.issuer).toMatch(/HelloPixels licensing application/);
    expect(license.features).toContain("mobile-api");
  });

  it("enforces nothing: unlimited checks always pass", async () => {
    expect(await checkLimit("maxTenants", 10_000)).toEqual({
      allowed: true,
      limit: null,
      used: 10_000,
    });
  });
});

describe("pluggable provider", () => {
  it("reads limits from the provider with the installation context", async () => {
    const getLicenseMock = vi.fn(
      async (): Promise<License> => ({
        edition: "enterprise",
        status: "active",
        issuer: "HelloPixels",
        licensee: "Acme",
        limits: { maxTenants: 2, maxUsersPerTenant: 50 },
        expiresAt: "2027-01-01",
        features: [],
      })
    );
    setLicenseProvider({ id: "test", getLicense: getLicenseMock });
    const verdict = await checkLimit("maxTenants", 2);
    expect(verdict.allowed).toBe(false);
    expect(getLicenseMock).toHaveBeenCalledWith({
      installationId: "inst-1",
      deploymentMode: "single-tenant",
    });
  });
});

describe("evaluateLimit / isLicenseExpired", () => {
  it("compares usage with the limit", () => {
    expect(evaluateLimit(5, 4, "tenants").allowed).toBe(true);
    expect(evaluateLimit(5, 5, "tenants")).toMatchObject({
      allowed: false,
      limit: 5,
    });
  });

  it("detects expiry", () => {
    const base = { expiresAt: "2020-01-01" } as License;
    expect(isLicenseExpired(base, new Date("2026-11-06"))).toBe(true);
    expect(isLicenseExpired({ ...base, expiresAt: null }, new Date())).toBe(
      false
    );
  });
});

describe("getInstallationId", () => {
  it("creates the id once and keeps an existing one", async () => {
    db.systemSetting.findUnique.mockResolvedValue(null);
    db.systemSetting.upsert.mockImplementation(
      async (args: { create: { value: string } }) => ({
        value: args.create.value,
      })
    );
    const id = await getInstallationId();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    const call = db.systemSetting.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ key: INSTALLATION_ID_KEY });
    expect(call.update).toEqual({});
  });
});
