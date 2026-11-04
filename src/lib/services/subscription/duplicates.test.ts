import { prisma } from "@/lib/db";
import { getSetting } from "@/lib/settings/service";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { findSimilarSubscriptions } from "./duplicates";

vi.mock("@/lib/db", () => ({
  prisma: { subscription: { findMany: vi.fn() } },
}));
vi.mock("@/lib/settings/service", () => ({ getSetting: vi.fn() }));

const rows = [
  {
    id: "sub-slack",
    status: "ACTIVE",
    amount: 100,
    currency: "USD",
    app: {
      name: "Slack",
      customWebsite: null,
      catalog: {
        website: "https://slack.com",
        aliases: ["Slack Technologies"],
      },
    },
  },
  {
    id: "sub-zendesk",
    status: "PAUSED",
    amount: 50,
    currency: "USD",
    app: { name: "Zendesk", customWebsite: "zendesk.com", catalog: null },
  },
];

describe("findSimilarSubscriptions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getSetting).mockResolvedValue(0.82 as never);
    vi.mocked(prisma.subscription.findMany).mockResolvedValue(rows as never);
  });

  it("returns an empty list for a blank name without querying", async () => {
    const result = await findSimilarSubscriptions("org-1", { name: "  " });
    expect(result).toEqual([]);
    expect(prisma.subscription.findMany).not.toHaveBeenCalled();
  });

  it("matches on normalised name similarity above the threshold", async () => {
    const result = await findSimilarSubscriptions("org-1", {
      name: "Slack Inc",
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      subscriptionId: "sub-slack",
      reason: "name",
      similarity: 1,
      status: "ACTIVE",
      amount: 100,
    });
    expect(getSetting).toHaveBeenCalledWith(
      "org-1",
      "subscriptions.duplicateSimilarityThreshold"
    );
  });

  it("matches on vendor domain regardless of name", async () => {
    const result = await findSimilarSubscriptions("org-1", {
      name: "Totally different",
      vendorDomain: "https://www.zendesk.com/pricing",
    });
    expect(result).toEqual([
      expect.objectContaining({
        subscriptionId: "sub-zendesk",
        reason: "domain",
      }),
    ]);
  });

  it("matches catalog aliases", async () => {
    const result = await findSimilarSubscriptions("org-1", {
      name: "slack technologies",
    });
    expect(result[0]).toMatchObject({
      subscriptionId: "sub-slack",
      reason: "alias",
    });
  });

  it("respects an explicit threshold and excludes the given id", async () => {
    const result = await findSimilarSubscriptions(
      "org-1",
      { name: "Slak" },
      { threshold: 0.5, excludeId: "sub-zendesk" }
    );
    expect(getSetting).not.toHaveBeenCalled();
    expect(prisma.subscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-1", id: { not: "sub-zendesk" } },
      })
    );
    expect(result.map((r) => r.subscriptionId)).toEqual(["sub-slack"]);
  });

  it("drops candidates below the threshold", async () => {
    const result = await findSimilarSubscriptions("org-1", { name: "Figma" });
    expect(result).toEqual([]);
  });
});
