// src/actions/extensions/status.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    organization: { findUnique: vi.fn() },
    extensionDevice: { findMany: vi.fn(), count: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/auth/require-auth", () => ({
  requireOrganization: vi.fn().mockResolvedValue({
    organizationId: "org-1",
    role: "ADMIN",
    userId: "admin-1",
  }),
}));

import { getExtensionStatus } from "./status";

function pagedWhere(): Record<string, unknown> {
  // Second findMany call is the paginated list (first is the stats query)
  return prisma.extensionDevice.findMany.mock.calls[1][0].where;
}

describe("getExtensionStatus status filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.organization.findUnique.mockResolvedValue({
      inactiveThresholdMinutes: 30,
    });
    prisma.extensionDevice.findMany.mockResolvedValue([]);
    prisma.extensionDevice.count.mockResolvedValue(0);
  });

  it("applies no status clause when nothing is selected (= all)", async () => {
    await getExtensionStatus({ statuses: [] });
    expect(pagedWhere()).toEqual({ organizationId: "org-1" });
    await getExtensionStatus({ status: "all" });
    expect(prisma.extensionDevice.findMany.mock.calls[3][0].where).toEqual({
      organizationId: "org-1",
    });
  });

  it("ORs several computed statuses in the database query", async () => {
    await getExtensionStatus({ statuses: ["revoked", "pending", "active"] });
    const where = pagedWhere() as { AND: Array<{ OR: unknown[] }> };
    const clauses = where.AND[0].OR as Record<string, unknown>[];
    expect(clauses).toHaveLength(3);
    expect(clauses[0]).toEqual({ status: "REVOKED" });
    expect(clauses[1]).toEqual({
      status: { not: "REVOKED" },
      onboardingCompletedAt: null,
    });
    expect(clauses[2]).toMatchObject({
      onboardingCompletedAt: { not: null },
      lastSeenAt: { gte: expect.any(Date) },
    });
    // count uses the same filter so pagination stays correct
    expect(prisma.extensionDevice.count.mock.calls[0][0].where).toBe(where);
  });

  it("keeps the legacy single status working", async () => {
    await getExtensionStatus({ status: "inactive" });
    const where = pagedWhere() as { AND: Array<{ OR: unknown[] }> };
    expect(where.AND[0].OR[0]).toMatchObject({
      OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: expect.any(Date) } }],
    });
  });
});
