import { describe, expect, it } from "vitest";
import {
  mapSubscriptionDetail,
  mapSubscriptionListItem,
} from "./subscription-crud-read.mappers";

const fullRow = {
  id: "sub-1",
  appId: "app-1",
  status: "PAUSED",
  billingCycle: "YEARLY",
  billingType: "PER_SEAT",
  amount: 1200,
  perSeatPrice: 10,
  currency: "AED",
  totalLicenses: 10,
  usedLicenses: 4,
  startDate: new Date("2026-01-01"),
  endDate: new Date("2026-12-31"),
  renewalDate: new Date("2026-12-01"),
  autoRenewal: false,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-02"),
  teamId: "team-1",
  team: { id: "team-1", name: "Platform" },
  subscriptionTeams: [{ team: { id: "team-1", name: "Platform" } }],
  assignedUsers: [{ user: { id: "u1", name: "A", email: "a@x" } }],
  app: {
    id: "app-1",
    name: "Slack",
    customLogoUrl: null,
    customWebsite: null,
    catalogId: "cat-slack",
    cancellationUrl: "https://slack.com/cancel",
    cancellationNotes: null,
    catalog: { logoUrl: "https://logo", website: "https://slack.com" },
  },
  category: {
    id: "c1",
    name: "Chat",
    color: "#f00",
    parent: { name: "Collaboration" },
  },
  tags: [{ tag: { id: "t1", name: "core", color: null } }],
  owner: { id: "o1", name: "Owner", email: "o@x" },
  isPersonal: true,
  isTrial: true,
  trialEndsAt: new Date("2026-02-01"),
  cancellationDeadline: new Date("2026-12-01"),
  paymentMethod: { id: "pm1", name: "Card" },
  costCenter: { id: "cc1", code: "CC01", name: "Eng" },
  contractUrl: null,
  notes: "n",
  renewalAlert30: true,
  renewalAlert60: false,
  renewalAlert90: false,
  noticePeriodDays: 30,
  reminderLeadDays: [7, 1],
  pausedAt: new Date("2026-03-01"),
  archivedAt: null,
  lastDetectedAmount: 1250,
  cancellationUrl: null,
  cancellationNotes: "call support",
  taxRate: { id: "tr1", name: "VAT", ratePercent: 5 },
  customFieldValues: [
    { value: "PO-7", field: { id: "f1", key: "po", label: "PO number" } },
  ],
};

describe("mapSubscriptionListItem", () => {
  it("maps relations into the list DTO", () => {
    const item = mapSubscriptionListItem(fullRow as never);
    expect(item).toMatchObject({
      appName: "Slack",
      appLogoUrl: "https://logo",
      status: "PAUSED",
      amount: 1200,
      perSeatPrice: 10,
      teamName: "Platform",
      teams: [{ id: "team-1", name: "Platform" }],
      assignedUsers: [{ id: "u1", name: "A", email: "a@x" }],
      category: {
        id: "c1",
        name: "Chat",
        parentName: "Collaboration",
        color: "#f00",
      },
      tags: [{ id: "t1", name: "core", color: null }],
      owner: { id: "o1", name: "Owner", email: "o@x" },
      isPersonal: true,
      isTrial: true,
      paymentMethod: { id: "pm1", name: "Card" },
      costCenter: { id: "cc1", code: "CC01", name: "Eng" },
    });
  });

  it("tolerates partial rows", () => {
    const item = mapSubscriptionListItem({
      id: "sub-2",
      appId: "app-2",
      app: { name: "Notion", customLogoUrl: "https://custom", catalog: null },
    } as never);
    expect(item).toMatchObject({
      appName: "Notion",
      appLogoUrl: "https://custom",
      category: null,
      tags: [],
      owner: null,
      isPersonal: false,
      teams: [],
      assignedUsers: [],
      amount: 0,
      perSeatPrice: null,
    });
  });
});

describe("mapSubscriptionDetail", () => {
  it("adds detail-only fields", () => {
    const detail = mapSubscriptionDetail(fullRow as never);
    expect(detail).toMatchObject({
      noticePeriodDays: 30,
      reminderLeadDays: [7, 1],
      lastDetectedAmount: 1250,
      cancellationNotes: "call support",
      taxRate: { id: "tr1", name: "VAT", ratePercent: 5 },
      customFieldValues: [
        { fieldId: "f1", key: "po", label: "PO number", value: "PO-7" },
      ],
      app: {
        catalogId: "cat-slack",
        website: "https://slack.com",
        cancellationUrl: "https://slack.com/cancel",
        cancellationNotes: null,
      },
      team: { id: "team-1", name: "Platform" },
    });
  });
});
