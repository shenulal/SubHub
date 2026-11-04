// src/actions/budget-settings.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock modules before imports
vi.mock("@/lib/db", () => ({
  prisma: {
    auditLog: { create: vi.fn() },
    cardTransaction: {
      aggregate: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/require-auth", () => ({
  requireOrganization: vi.fn(),
}));

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
  return { ...actual, getSettings: vi.fn(), setOrganizationSettings: vi.fn() };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { requireOrganization } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import { ForbiddenError, requirePermission } from "@/lib/rbac/service";
import { getSettings, setOrganizationSettings } from "@/lib/settings/service";
import { DEFAULT_BUDGET_SETTINGS } from "@/types/budget";
import {
  getBudgetSettings,
  getMonthlyBudgetForChart,
  updateBudgetSettings,
} from "./budget-settings";

function stubSettings(overrides: Partial<Record<string, unknown>> = {}) {
  vi.mocked(getSettings).mockResolvedValue({
    "finance.baseCurrency": DEFAULT_BUDGET_SETTINGS.currency,
    "finance.monthlyBudget": DEFAULT_BUDGET_SETTINGS.monthlyBudget,
    "finance.budgetAlertThresholdPercent":
      DEFAULT_BUDGET_SETTINGS.alertThreshold,
    ...overrides,
  } as any);
}

describe("budget-settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getBudgetSettings", () => {
    it("should return registry defaults when nothing is overridden", async () => {
      vi.mocked(requireOrganization).mockResolvedValue({
        organizationId: "org-1",
        userId: "user-1",
        role: "ADMIN",
      } as any);
      stubSettings();

      const result = await getBudgetSettings();

      expect(result).toEqual(DEFAULT_BUDGET_SETTINGS);
      expect(getSettings).toHaveBeenCalledWith("org-1", expect.any(Array));
    });

    it("should map registry values to budget settings", async () => {
      vi.mocked(requireOrganization).mockResolvedValue({
        organizationId: "org-1",
        userId: "user-1",
        role: "ADMIN",
      } as any);
      stubSettings({
        "finance.baseCurrency": "USD",
        "finance.monthlyBudget": 5000,
        "finance.budgetAlertThresholdPercent": 90,
      });

      const result = await getBudgetSettings();

      expect(result).toEqual({
        currency: "USD",
        monthlyBudget: 5000,
        alertThreshold: 90,
      });
    });
  });

  describe("updateBudgetSettings", () => {
    it("should write merged values through the registry and audit them", async () => {
      vi.mocked(requirePermission).mockResolvedValue({
        organizationId: "org-1",
        userId: "user-1",
      } as any);
      stubSettings({
        "finance.baseCurrency": "AED",
        "finance.monthlyBudget": 1000,
      });
      vi.mocked(setOrganizationSettings).mockResolvedValue([]);

      const result = await updateBudgetSettings({ monthlyBudget: 2500 });

      expect(result.success).toBe(true);
      expect(requirePermission).toHaveBeenCalledWith("budgets:manage");
      expect(setOrganizationSettings).toHaveBeenCalledWith(
        "org-1",
        {
          "finance.baseCurrency": "AED",
          "finance.monthlyBudget": 2500,
          "finance.budgetAlertThresholdPercent":
            DEFAULT_BUDGET_SETTINGS.alertThreshold,
        },
        "user-1"
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "UPDATE_SETTINGS" }),
        })
      );
    });

    it("should fail for users without budgets:manage", async () => {
      vi.mocked(requirePermission).mockRejectedValue(
        new ForbiddenError("budgets:manage")
      );

      const result = await updateBudgetSettings({ monthlyBudget: 1 });

      expect(result.success).toBe(false);
      expect(result.message).toBeTruthy();
      expect(setOrganizationSettings).not.toHaveBeenCalled();
    });

    it("should allow clearing the budget (auto mode)", async () => {
      vi.mocked(requirePermission).mockResolvedValue({
        organizationId: "org-1",
        userId: "user-1",
      } as any);
      stubSettings({ "finance.monthlyBudget": 1000 });
      vi.mocked(setOrganizationSettings).mockResolvedValue([]);

      await updateBudgetSettings({ monthlyBudget: null });

      expect(setOrganizationSettings).toHaveBeenCalledWith(
        "org-1",
        expect.objectContaining({ "finance.monthlyBudget": null }),
        "user-1"
      );
    });
  });

  describe("getMonthlyBudgetForChart", () => {
    it("should return set budget when monthlyBudget is not null", async () => {
      const budgetSettings = {
        currency: "KRW" as const,
        monthlyBudget: 5000000,
        alertThreshold: 80,
      };

      const result = await getMonthlyBudgetForChart(
        "org-1",
        new Date("2024-03-15"),
        budgetSettings
      );

      expect(result).toBe(5000000);
      expect(prisma.cardTransaction.aggregate).not.toHaveBeenCalled();
    });

    it("should return previous month card transactions sum when monthlyBudget is null", async () => {
      const budgetSettings = {
        currency: "KRW" as const,
        monthlyBudget: null,
        alertThreshold: 80,
      };

      vi.mocked(prisma.cardTransaction.aggregate).mockResolvedValue({
        _sum: { useAmt: { toNumber: () => 3500000 } },
      } as any);

      const result = await getMonthlyBudgetForChart(
        "org-1",
        new Date("2024-03-15"),
        budgetSettings
      );

      expect(result).toBe(3500000);
      expect(prisma.cardTransaction.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: "org-1",
            useDt: {
              gte: "20240201",
              lte: "20240231",
            },
          }),
        })
      );
    });

    it("should return 0 when no card transactions exist for previous month", async () => {
      const budgetSettings = {
        currency: "KRW" as const,
        monthlyBudget: null,
        alertThreshold: 80,
      };

      vi.mocked(prisma.cardTransaction.aggregate).mockResolvedValue({
        _sum: { useAmt: null },
      } as any);

      const result = await getMonthlyBudgetForChart(
        "org-1",
        new Date("2024-03-15"),
        budgetSettings
      );

      expect(result).toBe(0);
    });

    it("should handle year boundary correctly (January -> December)", async () => {
      const budgetSettings = {
        currency: "KRW" as const,
        monthlyBudget: null,
        alertThreshold: 80,
      };

      vi.mocked(prisma.cardTransaction.aggregate).mockResolvedValue({
        _sum: { useAmt: { toNumber: () => 2000000 } },
      } as any);

      await getMonthlyBudgetForChart(
        "org-1",
        new Date("2024-01-15"),
        budgetSettings
      );

      expect(prisma.cardTransaction.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            useDt: {
              gte: "20231201",
              lte: "20231231",
            },
          }),
        })
      );
    });
  });
});
