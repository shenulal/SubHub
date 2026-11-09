// src/lib/settings/service.test.ts
import { prisma } from "@/lib/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getDefaultSettings,
  isSettingKey,
  listSettingsByGroup,
  SETTING_DEFINITIONS,
  SETTING_KEYS,
} from "./registry";
import {
  getOrganizationSettings,
  getSetting,
  getSystemSetting,
  maskSensitiveSettings,
  setOrganizationSetting,
  setOrganizationSettings,
  setSystemSetting,
  SettingValidationError,
} from "./service";

vi.mock("@/lib/db", () => ({
  prisma: {
    organizationSetting: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    systemSetting: { findMany: vi.fn(), upsert: vi.fn() },
    $transaction: vi.fn(async (ops: unknown[]) =>
      Promise.all(ops as Promise<unknown>[])
    ),
  },
}));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;
const ORG = "org-1";

describe("settings registry", () => {
  it("every definition has a default that satisfies its own schema", () => {
    for (const key of SETTING_KEYS) {
      const def = SETTING_DEFINITIONS[key];
      expect(def.schema.safeParse(def.defaultValue).success, key).toBe(true);
      expect(def.key).toBe(key);
    }
  });

  it("groups and keys resolve", () => {
    expect(isSettingKey("finance.baseCurrency")).toBe(true);
    expect(isSettingKey("nope")).toBe(false);
    expect(listSettingsByGroup("finance").length).toBeGreaterThan(3);
    expect(getDefaultSettings()["general.timezone"]).toBe("Asia/Dubai");
  });
});

describe("settings service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.organizationSetting.findMany.mockResolvedValue([]);
    db.systemSetting.findMany.mockResolvedValue([]);
  });

  it("falls back to the registry default when nothing is stored", async () => {
    expect(await getSetting(ORG, "finance.baseCurrency")).toBe("AED");
  });

  it("prefers organisation override, then system override, then default", async () => {
    db.systemSetting.findMany.mockResolvedValue([
      { key: "finance.baseCurrency", value: "USD" },
      { key: "general.timezone", value: "Europe/London" },
    ]);
    db.organizationSetting.findMany.mockResolvedValue([
      { key: "finance.baseCurrency", value: "SAR" },
    ]);
    const all = await getOrganizationSettings(ORG);
    expect(all["finance.baseCurrency"]).toBe("SAR");
    expect(all["general.timezone"]).toBe("Europe/London");
    expect(all["approvals.enabled"]).toBe(true);
  });

  it("ignores a stored value that fails validation and uses the default", async () => {
    db.organizationSetting.findMany.mockResolvedValue([
      { key: "finance.baseCurrency", value: "not-a-code" },
    ]);
    expect(await getSetting(ORG, "finance.baseCurrency")).toBe("AED");
  });

  it("rejects invalid writes and unknown or system-scoped keys", async () => {
    await expect(
      setOrganizationSetting(ORG, "finance.baseCurrency", "xx")
    ).rejects.toBeInstanceOf(SettingValidationError);
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setOrganizationSetting(ORG, "does.not.exist" as any, 1)
    ).rejects.toBeInstanceOf(SettingValidationError);
    await expect(
      setOrganizationSetting(ORG, "system.allowSelfSignup", false)
    ).rejects.toBeInstanceOf(SettingValidationError);
    expect(db.organizationSetting.upsert).not.toHaveBeenCalled();
  });

  it("persists validated organisation overrides (coercing numbers)", async () => {
    db.organizationSetting.upsert.mockResolvedValue({});
    const result = await setOrganizationSetting(
      ORG,
      "approvals.defaultReminderAfterDays",
      "3",
      "user-1"
    );
    expect(result.value).toBe(3);
    expect(db.organizationSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId_key: {
            organizationId: ORG,
            key: "approvals.defaultReminderAfterDays",
          },
        },
      })
    );
    await setOrganizationSettings(ORG, {
      "finance.baseCurrency": "USD",
      "approvals.enabled": false,
    });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("system settings resolve and persist", async () => {
    db.systemSetting.upsert.mockResolvedValue({});
    await setSystemSetting("system.maintenanceMode", true);
    expect(db.systemSetting.upsert).toHaveBeenCalled();
    db.systemSetting.findMany.mockResolvedValue([
      { key: "system.maintenanceMode", value: true },
    ]);
    expect(await getSystemSetting("system.maintenanceMode")).toBe(true);
  });

  it("masks sensitive values", () => {
    const masked = maskSensitiveSettings({
      ...getDefaultSettings(),
      "finance.fxApiKey": "abcdef123456",
    });
    expect(masked["finance.fxApiKey"]).toBe("••••3456");
  });
});

describe("public sign-up default", () => {
  it("is off when the platform has not stored a value", async () => {
    db.systemSetting.findMany.mockResolvedValue([]);
    expect(SETTING_DEFINITIONS["system.allowSelfSignup"].defaultValue).toBe(
      false
    );
    await expect(getSystemSetting("system.allowSelfSignup")).resolves.toBe(
      false
    );
  });
});
