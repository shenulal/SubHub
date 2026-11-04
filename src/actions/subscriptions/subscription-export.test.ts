import { prisma } from "@/lib/db";
import { getUserPermissionSet, requirePermission } from "@/lib/rbac/service";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { exportSubscriptions } from "./subscription-export";
import {
  rowsToCsv,
  SUBSCRIPTION_EXPORT_COLUMNS,
  subscriptionToCsvRow,
} from "./subscription-export.utils";

vi.mock("@/lib/db", () => ({
  prisma: {
    subscription: { findMany: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));
vi.mock("@/lib/rbac/service", () => ({
  requirePermission: vi.fn(),
  getUserPermissionSet: vi.fn(),
  isForbiddenError: () => false,
}));

const row = {
  id: "sub-1",
  app: { name: "Slack, Inc" },
  status: "ACTIVE",
  category: { name: "Chat", parent: { name: "Collaboration" }, color: null },
  tags: [{ tag: { name: "core" } }, { tag: { name: "eng" } }],
  amount: 120.5,
  currency: "AED",
  billingCycle: "MONTHLY",
  billingType: "FLAT_RATE",
  startDate: new Date("2026-01-01T00:00:00Z"),
  endDate: new Date("2026-12-31T00:00:00Z"),
  renewalDate: new Date("2026-12-01T00:00:00Z"),
  autoRenewal: true,
  isTrial: false,
  trialEndsAt: null,
  noticePeriodDays: 30,
  cancellationDeadline: new Date("2026-12-01T00:00:00Z"),
  owner: { name: "Aisha", email: "aisha@example.com" },
  costCenter: { code: "CC01", name: "Engineering" },
  paymentMethod: { name: "Corporate card" },
  taxRate: { name: "UAE VAT", ratePercent: 5 },
  subscriptionTeams: [{ team: { name: "Platform" } }],
  assignedUsers: [{ user: { name: null, email: "bob@example.com" } }],
  isPersonal: false,
  notes: 'Line "quoted"\nsecond',
  customFieldValues: [{ field: { label: "PO number" }, value: "PO-7" }],
};

describe("subscriptionToCsvRow / rowsToCsv", () => {
  it("emits every column in order", () => {
    const values = subscriptionToCsvRow(row as never);
    expect(values).toHaveLength(SUBSCRIPTION_EXPORT_COLUMNS.length);
    expect(values.slice(0, 5)).toEqual([
      "Slack, Inc",
      "ACTIVE",
      "Chat",
      "Collaboration",
      "core; eng",
    ]);
    expect(values[16]).toBe("2026-12-01");
    expect(values[19]).toBe("CC01 Engineering");
    expect(values[21]).toBe("UAE VAT (5%)");
    expect(values[23]).toBe("bob@example.com");
    expect(values[26]).toBe("PO number=PO-7");
  });

  it("escapes commas, quotes and newlines and prefixes a BOM", () => {
    const csv = rowsToCsv([subscriptionToCsvRow(row as never)]);
    expect(csv.startsWith("﻿Vendor,Status,")).toBe(true);
    expect(csv).toContain('"Slack, Inc"');
    expect(csv).toContain('"Line ""quoted""\nsecond"');
  });
});

describe("exportSubscriptions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requirePermission).mockResolvedValue({
      organizationId: "org-1",
      userId: "user-1",
      role: "MEMBER",
      permissions: new Set(),
    } as never);
    vi.mocked(getUserPermissionSet).mockResolvedValue(new Set());
    vi.mocked(prisma.subscription.findMany).mockResolvedValue([row] as never);
  });

  it("requires subscriptions:export, scopes the query and audits", async () => {
    const result = await exportSubscriptions({ status: "ACTIVE" });
    expect(requirePermission).toHaveBeenCalledWith("subscriptions:export");
    expect(prisma.subscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org-1",
          status: "ACTIVE",
        }),
      })
    );
    expect(result.success).toBe(true);
    expect(result.data?.rowCount).toBe(1);
    expect(result.data?.fileName).toMatch(
      /^subscriptions-\d{4}-\d{2}-\d{2}\.csv$/
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "EXPORT_SUBSCRIPTIONS" }),
      })
    );
  });
});
