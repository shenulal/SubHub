// src/actions/discovery/search.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ALL_READ,
  FakeForbidden,
  ORG,
  permissionResult,
  USER,
} from "./test-helpers";

const { prisma, requirePermission, getSettings } = vi.hoisted(() => {
  const prisma = {
    subscription: { findMany: vi.fn(), count: vi.fn() },
    savedView: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
    approvalRequest: { findMany: vi.fn() },
    saaSCatalog: { findMany: vi.fn() },
    category: { findMany: vi.fn() },
    tag: { findMany: vi.fn() },
    team: { findMany: vi.fn() },
    costCenter: { findMany: vi.fn() },
    paymentMethodOption: { findMany: vi.fn() },
    billingCycleConfig: { findMany: vi.fn() },
  };
  const requirePermission = vi.fn();
  const getSettings = vi.fn();
  return { prisma, requirePermission, getSettings };
});

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/rbac/service", () => ({
  requirePermission: (...args: unknown[]) => requirePermission(...args),
  isForbiddenError: (e: unknown) => e instanceof FakeForbidden,
}));
vi.mock("@/lib/settings/service", () => ({
  getSettings: (...args: unknown[]) => getSettings(...args),
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock("./scope", () => ({
  getWorkspaceScope: vi
    .fn()
    .mockResolvedValue({ scope: "workspace", allowPersonal: true }),
}));

import { globalSearch } from "./search";

describe("globalSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermission.mockResolvedValue(permissionResult(ALL_READ));
    getSettings.mockResolvedValue({
      "discovery.searchResultLimit": 8,
      "discovery.searchMinChars": 2,
      "discovery.recentSearchesLimit": 5,
    });
    prisma.user.findUnique.mockResolvedValue({ teamId: "team-1" });
    prisma.subscription.findMany.mockResolvedValue([
      {
        id: "s1",
        status: "ACTIVE",
        amount: 10,
        currency: "AED",
        app: {
          name: "Slack",
          customLogoUrl: null,
          catalog: { logoUrl: "https://l/slack.png", vendorName: "Salesforce" },
        },
        category: { name: "Chat" },
      },
    ]);
    prisma.saaSCatalog.findMany.mockResolvedValue([
      {
        id: "c1",
        name: "Slack",
        category: "Collaboration",
        logoUrl: null,
        slug: "slack",
      },
    ]);
    prisma.approvalRequest.findMany.mockResolvedValue([
      {
        id: "a1",
        serviceName: "Slack Pro",
        status: "PENDING",
        requester: { name: "Sara", email: "s@x.com" },
      },
    ]);
    prisma.user.findMany.mockResolvedValue([
      { id: "u2", name: "Slackbot Sam", email: "sam@x.com", avatarUrl: null },
    ]);
  });

  it("returns grouped results in a stable order with static pages/actions", async () => {
    const result = await globalSearch("sla");
    expect(result.success).toBe(true);
    const keys = result.data!.groups.map((g) => g.key);
    expect(keys).toEqual(["subscriptions", "approvals", "vendors", "people"]);
    expect(result.data!.groups[0].items[0]).toMatchObject({
      href: "/subscriptions/s1",
      imageUrl: "https://l/slack.png",
      subtitle: "Chat · Salesforce · ACTIVE",
    });
    expect(result.data!.meta).toEqual({
      limit: 8,
      minChars: 2,
      recentSearchesLimit: 5,
    });
  });

  it("includes matching pages and actions from the catalogue", async () => {
    prisma.subscription.findMany.mockResolvedValue([]);
    prisma.saaSCatalog.findMany.mockResolvedValue([]);
    prisma.approvalRequest.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);
    const result = await globalSearch("pipeline");
    expect(result.data!.groups.map((g) => g.key)).toEqual(["pages"]);
    expect(result.data!.groups[0].items[0].href).toBe(
      "/subscriptions/pipeline"
    );
  });

  it("skips groups the viewer may not read and restricts approvals to own requests", async () => {
    requirePermission.mockResolvedValue(
      permissionResult(["subscriptions:read", "approvals:read"])
    );
    const result = await globalSearch("slack");
    const keys = result.data!.groups.map((g) => g.key);
    expect(keys).not.toContain("people");
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.approvalRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ requesterId: USER }),
      })
    );
    // Row-level visibility applied for non read_all viewers.
    const where = prisma.subscription.findMany.mock.calls[0][0].where;
    expect(JSON.stringify(where)).toContain('"ownerId":"user-1"');
    expect(JSON.stringify(where)).toContain(`"organizationId":"${ORG}"`);
  });

  it("only returns catalogue entries when the query is shorter than minChars", async () => {
    const result = await globalSearch("s");
    expect(prisma.subscription.findMany).not.toHaveBeenCalled();
    expect(
      result.data!.groups.every((g) => g.key === "pages" || g.key === "actions")
    ).toBe(true);
  });

  it("caps the limit by the organisation setting and rejects bad input", async () => {
    await globalSearch("slack", { limit: 50 });
    expect(prisma.subscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 8 })
    );
    expect((await globalSearch("x".repeat(500))).success).toBe(false);
  });

  it("maps forbidden errors to a failed action state", async () => {
    requirePermission.mockRejectedValue(
      new FakeForbidden("subscriptions:read")
    );
    expect(await globalSearch("slack")).toMatchObject({ success: false });
  });

  it("degrades gracefully when one group's query throws", async () => {
    prisma.saaSCatalog.findMany.mockRejectedValue(new Error("boom"));
    const result = await globalSearch("slack");
    expect(result.success).toBe(true);
    expect(
      result.data!.groups.find((g) => g.key === "vendors")
    ).toBeUndefined();
    expect(
      result.data!.groups.find((g) => g.key === "subscriptions")
    ).toBeDefined();
  });
});
