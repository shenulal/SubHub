// src/components/subscriptions/test-fixtures.ts
/** Shared fixtures for subscription component tests (not a test file). */
import type {
  DiscoverySubscriptionItem,
  SubscriptionFilterOptions,
} from "@/types/discovery";

export function makeSubscription(
  patch: Partial<DiscoverySubscriptionItem> = {}
): DiscoverySubscriptionItem {
  return {
    id: "sub-1",
    appId: "app-1",
    appName: "Slack",
    appLogoUrl: null,
    status: "ACTIVE",
    billingCycle: "MONTHLY",
    billingType: "FLAT_RATE",
    amount: 100,
    perSeatPrice: null,
    currency: "AED",
    totalLicenses: null,
    usedLicenses: null,
    startDate: new Date("2026-01-01"),
    endDate: null,
    renewalDate: new Date("2026-12-01"),
    autoRenewal: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    teamId: null,
    teamName: null,
    teams: [],
    assignedUsers: [],
    category: {
      id: "c1",
      name: "Chat",
      parentName: "Productivity",
      color: "#6366f1",
    },
    tags: [{ id: "t1", name: "core", color: null }],
    owner: { id: "u1", name: "Sara", email: "sara@example.com" },
    isPersonal: false,
    isTrial: false,
    trialEndsAt: null,
    cancellationDeadline: null,
    monthlyAmountBase: 100,
    paymentMethod: null,
    costCenter: null,
    ...patch,
  };
}

export const filterOptions: SubscriptionFilterOptions = {
  categories: [
    {
      id: "p1",
      name: "Productivity",
      color: null,
      parentId: null,
      children: [{ id: "c1", name: "Chat", color: null, parentId: "p1" }],
    },
  ],
  tags: [
    { id: "t1", name: "core", color: null },
    { id: "t2", name: "trial", color: "#f00" },
  ],
  owners: [{ id: "u1", name: "Sara" }],
  teams: [{ id: "team-1", name: "Ops" }],
  costCenters: [{ id: "cc1", name: "ENG · Engineering" }],
  paymentMethods: [{ id: "pm1", name: "Corporate card" }],
};
