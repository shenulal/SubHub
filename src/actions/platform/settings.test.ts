import { prisma } from "@/lib/db";
import { ForbiddenError, requirePermission } from "@/lib/rbac/service";
import {
  getOrganizationSettings,
  resetOrganizationSetting,
  setOrganizationSettings,
} from "@/lib/settings/service";
import { SECRET_UNCHANGED } from "@/types/platform";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getWorkspaceSettings,
  resetWorkspaceSetting,
  updateWorkspaceSettings,
} from "./settings";

vi.mock("@/lib/db", () => ({
  prisma: {
    organizationSetting: { findMany: vi.fn() },
    auditLog: { create: vi.fn() },
    currency: { findMany: vi.fn() },
    country: { findMany: vi.fn() },
    role: { findMany: vi.fn() },
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
    getOrganizationSettings: vi.fn(),
    setOrganizationSettings: vi.fn(),
    resetOrganizationSetting: vi.fn(),
  };
});
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const ctx = { organizationId: "org-1", userId: "user-1" };
const mockedRequire = vi.mocked(requirePermission);
const mockedResolved = vi.mocked(getOrganizationSettings);
const mockedSet = vi.mocked(setOrganizationSettings);

function resolvedWith(overrides: Record<string, unknown> = {}) {
  mockedResolved.mockResolvedValue({
    "finance.baseCurrency": "AED",
    "finance.enabledCurrencies": ["AED", "USD"],
    "finance.fxApiKey": "super-secret-key",
    "finance.fxProvider": "open_er_api",
    "finance.monthlyBudget": null,
    ...overrides,
  } as never);
}

describe("getWorkspaceSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequire.mockResolvedValue(ctx as never);
    vi.mocked(prisma.organizationSetting.findMany).mockResolvedValue([
      { key: "finance.baseCurrency" },
    ] as never);
    vi.mocked(prisma.currency.findMany).mockResolvedValue([
      { code: "AED", name: "UAE Dirham", symbol: "AED" },
    ] as never);
    resolvedWith();
  });

  it("serialises the group definitions with masked secrets, override flags and dynamic options", async () => {
    const result = await getWorkspaceSettings("finance");
    expect(result.success).toBe(true);
    const defs = result.data!.definitions;
    expect(mockedRequire).toHaveBeenCalledWith("settings:read");
    expect(
      defs.every((d) => d.group === "finance" && d.scope === "organization")
    ).toBe(true);
    const apiKey = defs.find((d) => d.key === "finance.fxApiKey")!;
    expect(apiKey.value).toBe("••••-key");
    expect(
      defs.find((d) => d.key === "finance.baseCurrency")!.isOverridden
    ).toBe(true);
    expect(defs.find((d) => d.key === "finance.baseCurrency")!.options).toEqual(
      [{ value: "AED", label: "AED — UAE Dirham (AED)" }]
    );
  });

  it("rejects the system group and unknown groups", async () => {
    expect((await getWorkspaceSettings("system")).success).toBe(false);
    expect((await getWorkspaceSettings("nope")).success).toBe(false);
  });

  it("maps ForbiddenError to an error state", async () => {
    mockedRequire.mockRejectedValue(new ForbiddenError("settings:read"));
    const result = await getWorkspaceSettings("finance");
    expect(result).toMatchObject({ success: false });
  });
});

describe("updateWorkspaceSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequire.mockResolvedValue(ctx as never);
    resolvedWith();
    mockedSet.mockImplementation(
      async (_org, values) =>
        Object.entries(values).map(([key, value]) => ({ key, value })) as never
    );
  });

  it("writes only group keys, skips untouched secrets and audits the diff with redaction", async () => {
    const result = await updateWorkspaceSettings("finance", {
      "finance.baseCurrency": "USD",
      "finance.fxApiKey": SECRET_UNCHANGED,
      "finance.fxProvider": "open_er_api",
    });
    expect(result.success).toBe(true);
    expect(mockedRequire).toHaveBeenCalledWith("settings:manage");
    expect(mockedSet).toHaveBeenCalledWith(
      "org-1",
      { "finance.baseCurrency": "USD", "finance.fxProvider": "open_er_api" },
      "user-1"
    );
    expect(result.data?.updatedKeys).toEqual(["finance.baseCurrency"]);
    const audit = vi.mocked(prisma.auditLog.create).mock.calls[0][0].data;
    expect(audit.action).toBe("UPDATE_SETTINGS");
    expect(audit.changes).toEqual({
      "finance.baseCurrency": { from: "AED", to: "USD" },
    });
  });

  it("redacts secret values in the audit log", async () => {
    await updateWorkspaceSettings("finance", { "finance.fxApiKey": "new-key" });
    const audit = vi.mocked(prisma.auditLog.create).mock.calls[0][0].data;
    expect(audit.changes).toEqual({
      "finance.fxApiKey": { from: "[redacted]", to: "[redacted]" },
    });
  });

  it("refuses keys from another group or system scope", async () => {
    expect(
      (await updateWorkspaceSettings("finance", { "general.timezone": "UTC" }))
        .success
    ).toBe(false);
    expect(
      (
        await updateWorkspaceSettings("documents", {
          "documents.storageProvider": "s3",
        })
      ).success
    ).toBe(false);
    expect(mockedSet).not.toHaveBeenCalled();
  });

  it("surfaces registry validation errors per key", async () => {
    const { SettingValidationError } = await vi.importActual<
      typeof import("@/lib/settings/service")
    >("@/lib/settings/service");
    mockedSet.mockRejectedValue(
      new SettingValidationError("finance.baseCurrency", [
        "ISO 4217 code expected",
      ])
    );
    const result = await updateWorkspaceSettings("finance", {
      "finance.baseCurrency": "dirham",
    });
    expect(result.success).toBe(false);
    expect(result.errors).toEqual({
      "finance.baseCurrency": ["ISO 4217 code expected"],
    });
  });
});

describe("resetWorkspaceSetting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequire.mockResolvedValue(ctx as never);
    resolvedWith();
  });

  it("removes the override and returns the resolved value", async () => {
    const result = await resetWorkspaceSetting("finance.baseCurrency");
    expect(result).toMatchObject({ success: true, data: { value: "AED" } });
    expect(resetOrganizationSetting).toHaveBeenCalledWith(
      "org-1",
      "finance.baseCurrency"
    );
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it("rejects unknown keys", async () => {
    expect((await resetWorkspaceSetting("finance.nope")).success).toBe(false);
  });
});
