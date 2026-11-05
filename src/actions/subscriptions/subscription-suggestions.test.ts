// src/actions/subscriptions/subscription-suggestions.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock modules
vi.mock("@/lib/fx/base-currency", () => ({
  getBaseCurrency: vi.fn().mockResolvedValue("KRW"),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/utils/renewal-date", () => ({
  calculateNextRenewalDate: vi.fn().mockReturnValue(new Date("2025-04-01")),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    taxRate: {
      findFirst: vi.fn(),
    },
    subscription: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    cardTransaction: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    corporateCard: {
      findUnique: vi.fn(),
    },
    app: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    appTeam: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    team: {
      findUnique: vi.fn(),
    },
    paymentRecord: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    subscriptionUser: {
      createMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

// Mock next/navigation redirect
const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mockRedirect(url);
    const error = new Error(`NEXT_REDIRECT:${url}`);
    (error as Error & { digest: string }).digest = `NEXT_REDIRECT:${url}`;
    throw error;
  },
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type {
  CardTransactionSuggestion,
  PaymentRecordSuggestion,
} from "./subscription-suggestions";
import {
  createSubscriptionFromCardSuggestion,
  createSubscriptionFromPaymentSuggestion,
  ensureAppTeamAssignment,
  suggestFromCardTransactions,
  suggestSubscriptionsFromPayments,
} from "./subscription-suggestions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockedAuth = auth as any;

describe("subscription-suggestions (Phase 3)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(prisma.taxRate.findFirst).mockResolvedValue({
      ratePercent: 5,
    } as never);
    mockRedirect.mockClear();
  });

  describe("suggestFromCardTransactions", () => {
    const mockOrgId = "org-123";

    beforeEach(() => {
      mockedAuth.mockResolvedValue({
        user: {
          id: "user-123",
          organizationId: mockOrgId,
          role: "ADMIN",
          teamId: null,
        },
        expires: "",
      });
    });

    it("returns an empty array when there are no card transactions", async () => {
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);
      vi.mocked(prisma.cardTransaction.groupBy).mockResolvedValue([]);

      const result = await suggestFromCardTransactions();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it("excludes apps that already have a subscription", async () => {
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([
        { appId: "app-existing" },
      ] as never);
      vi.mocked(prisma.cardTransaction.groupBy).mockResolvedValue([
        {
          matchedAppId: "app-existing",
          _count: { id: 3 },
          _sum: { useAmt: 150000 },
          _min: { useDt: "20250101" },
          _max: { useDt: "20250301" },
        },
      ] as never);

      const result = await suggestFromCardTransactions();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it("skips apps with fewer than 2 transactions", async () => {
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);
      vi.mocked(prisma.cardTransaction.groupBy).mockResolvedValue([
        {
          matchedAppId: "app-1",
          _count: { id: 1 },
          _sum: { useAmt: 50000 },
          _min: { useDt: "20250101" },
          _max: { useDt: "20250101" },
        },
      ] as never);

      const result = await suggestFromCardTransactions();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it("includes the dominant card's teamId and availableUsers", async () => {
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);

      // First call: group by app
      vi.mocked(prisma.cardTransaction.groupBy)
        .mockResolvedValueOnce([
          {
            matchedAppId: "app-1",
            _count: { id: 3 },
            _sum: { useAmt: 150000 },
            _min: { useDt: "20250101" },
            _max: { useDt: "20250301" },
          },
        ] as never)
        // Second call: load the dominant card
        .mockResolvedValueOnce([
          { corporateCardId: "card-1", _count: { id: 3 } },
        ] as never);

      vi.mocked(prisma.app.findUnique).mockResolvedValue({
        id: "app-1",
        name: "Slack",
        customLogoUrl: null,
        catalog: { logoUrl: "https://slack.com/logo.png" },
      } as never);

      vi.mocked(prisma.corporateCard.findUnique).mockResolvedValue({
        id: "card-1",
        team: {
          id: "team-marketing",
          name: "Marketing",
          members: [
            { id: "user-1", name: "Ahmed Hassan", email: "hong@test.com" },
            { id: "user-2", name: "Omar Khalid", email: "kim@test.com" },
          ],
        },
        assignedUser: null,
      } as never);

      vi.mocked(prisma.cardTransaction.findMany).mockResolvedValue([
        {
          id: "tx-1",
          useDt: "20250101",
          useAmt: 50000,
          teamId: null,
          userId: null,
          linkedSubscriptionId: null,
        },
        {
          id: "tx-2",
          useDt: "20250201",
          useAmt: 50000,
          teamId: null,
          userId: null,
          linkedSubscriptionId: null,
        },
        {
          id: "tx-3",
          useDt: "20250301",
          useAmt: 50000,
          teamId: null,
          userId: null,
          linkedSubscriptionId: null,
        },
      ] as never);

      // appendUnassignedUsers: no users with teamId=null
      vi.mocked(prisma.user.findMany).mockResolvedValue([]);

      const result = await suggestFromCardTransactions();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].teamId).toBe("team-marketing");
      expect(result.data![0].teamName).toBe("Marketing");
      expect(result.data![0].availableUsers).toHaveLength(2);
      expect(result.data![0].source).toBe("card_transaction");
    });

    it("sets teamId to null and includes all organization members in availableUsers when neither the card nor the transactions have a team/user", async () => {
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);

      vi.mocked(prisma.cardTransaction.groupBy)
        .mockResolvedValueOnce([
          {
            matchedAppId: "app-1",
            _count: { id: 3 },
            _sum: { useAmt: 150000 },
            _min: { useDt: "20250101" },
            _max: { useDt: "20250301" },
          },
        ] as never)
        .mockResolvedValueOnce([
          { corporateCardId: "card-1", _count: { id: 3 } },
        ] as never);

      vi.mocked(prisma.app.findUnique).mockResolvedValue({
        id: "app-1",
        name: "Slack",
        customLogoUrl: null,
        catalog: null,
      } as never);

      vi.mocked(prisma.corporateCard.findUnique).mockResolvedValue({
        id: "card-1",
        team: null,
        assignedUser: null,
      } as never);

      vi.mocked(prisma.cardTransaction.findMany).mockResolvedValue([
        {
          id: "tx-1",
          useDt: "20250101",
          useAmt: 50000,
          teamId: null,
          userId: null,
          linkedSubscriptionId: null,
        },
        {
          id: "tx-2",
          useDt: "20250201",
          useAmt: 50000,
          teamId: null,
          userId: null,
          linkedSubscriptionId: null,
        },
        {
          id: "tx-3",
          useDt: "20250301",
          useAmt: 50000,
          teamId: null,
          userId: null,
          linkedSubscriptionId: null,
        },
      ] as never);

      // SMP-156: fall back to all organization members
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: "user-1", name: "User 1", email: "user1@test.com" },
      ] as never);

      const result = await suggestFromCardTransactions();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].teamId).toBeNull();
      expect(result.data![0].teamName).toBeNull();
      // SMP-156: fall back to all organization members when no team/user is assigned
      expect(result.data![0].availableUsers).toHaveLength(1);
    });

    it("filters by organizationId (multi-tenant)", async () => {
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);
      vi.mocked(prisma.cardTransaction.groupBy).mockResolvedValue([]);

      await suggestFromCardTransactions();

      expect(prisma.cardTransaction.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: mockOrgId,
          }),
        })
      );
    });
  });

  describe("createSubscriptionFromCardSuggestion", () => {
    const mockOrgId = "org-123";
    const mockUserId = "user-123";

    const baseSuggestion: CardTransactionSuggestion = {
      appId: "app-1",
      appName: "Slack",
      appLogoUrl: "https://slack.com/logo.png",
      suggestedBillingCycle: "MONTHLY",
      suggestedAmount: 50000,
      currency: "KRW",
      paymentCount: 3,
      firstPaymentDate: new Date("2025-01-01"),
      lastPaymentDate: new Date("2025-03-01"),
      confidence: 0.85,
      teamId: "team-marketing",
      teamName: "Marketing",
      assignedUserId: null,
      assignedUserName: null,
      availableUsers: [
        {
          id: "user-1",
          name: "Ahmed Hassan",
          email: "hong@test.com",
          teamId: "team-marketing",
          teamName: "Marketing",
        },
        {
          id: "user-2",
          name: "Omar Khalid",
          email: "kim@test.com",
          teamId: "team-marketing",
          teamName: "Marketing",
        },
      ],
      source: "card_transaction",
      // SMP-123: additional fields
      suggestedAction: "create",
      unmatchedTransactionIds: ["tx-1", "tx-2", "tx-3"],
      // SMP-134: seat-based subscription detection
      billingType: "PER_SEAT",
      perSeatPrice: null,
      suggestedSeats: null,
    };

    beforeEach(() => {
      mockedAuth.mockResolvedValue({
        user: {
          id: mockUserId,
          organizationId: mockOrgId,
          role: "ADMIN",
          teamId: null,
        },
        expires: "",
      });
      // SMP-123: shared mock setup (for ensureAppTeamAssignment)
      vi.mocked(prisma.appTeam.findFirst).mockResolvedValue({
        id: "app-team-1",
        appId: "app-1",
        teamId: "team-marketing",
      } as never);
      vi.mocked(prisma.cardTransaction.updateMany).mockResolvedValue({
        count: 3,
      } as never);
    });

    it("creates the subscription including the suggestion's teamId", async () => {
      vi.mocked(prisma.app.findFirst).mockResolvedValue({
        id: "app-1",
        name: "Slack",
      } as never);
      vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.subscription.create).mockResolvedValue({
        id: "sub-1",
      } as never);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      const result = await createSubscriptionFromCardSuggestion({
        suggestion: baseSuggestion,
        selectedUserIds: [],
      });

      expect(result.success).toBe(true);
      expect(prisma.subscription.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          teamId: "team-marketing",
          appId: "app-1",
        }),
      });
    });

    it("creates SubscriptionUser records for the selected users", async () => {
      vi.mocked(prisma.app.findFirst).mockResolvedValue({
        id: "app-1",
        name: "Slack",
      } as never);
      vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: "user-1" },
        { id: "user-2" },
      ] as never);
      vi.mocked(prisma.subscription.create).mockResolvedValue({
        id: "sub-1",
      } as never);
      vi.mocked(prisma.subscriptionUser.createMany).mockResolvedValue({
        count: 2,
      } as never);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      const result = await createSubscriptionFromCardSuggestion({
        suggestion: baseSuggestion,
        selectedUserIds: ["user-1", "user-2"],
      });

      expect(result.success).toBe(true);
      expect(prisma.subscriptionUser.createMany).toHaveBeenCalledWith({
        data: [
          { subscriptionId: "sub-1", userId: "user-1", assignedBy: mockUserId },
          { subscriptionId: "sub-1", userId: "user-2", assignedBy: mockUserId },
        ],
        skipDuplicates: true, // SMP-123: skipDuplicates added
      });
    });

    it("rejects user assignment for non-ADMIN users", async () => {
      mockedAuth.mockResolvedValue({
        user: {
          id: mockUserId,
          organizationId: mockOrgId,
          role: "MEMBER",
          teamId: null,
        },
        expires: "",
      });

      const result = await createSubscriptionFromCardSuggestion({
        suggestion: baseSuggestion,
        selectedUserIds: ["user-1"],
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe("Only admins can assign users");
    });

    it("allows non-ADMIN users when no users are selected", async () => {
      mockedAuth.mockResolvedValue({
        user: {
          id: mockUserId,
          organizationId: mockOrgId,
          role: "MEMBER",
          teamId: null,
        },
        expires: "",
      });
      vi.mocked(prisma.app.findFirst).mockResolvedValue({
        id: "app-1",
        name: "Slack",
      } as never);
      vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.subscription.create).mockResolvedValue({
        id: "sub-1",
      } as never);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      const result = await createSubscriptionFromCardSuggestion({
        suggestion: baseSuggestion,
        selectedUserIds: [],
      });

      expect(result.success).toBe(true);
    });

    it("rejects when a subscription already exists", async () => {
      vi.mocked(prisma.app.findFirst).mockResolvedValue({
        id: "app-1",
        name: "Slack",
      } as never);
      vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
        id: "existing-sub",
      } as never);

      const result = await createSubscriptionFromCardSuggestion({
        suggestion: baseSuggestion,
        selectedUserIds: [],
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe("A subscription for this app already exists");
    });

    it("rejects when invalid users are included", async () => {
      vi.mocked(prisma.app.findFirst).mockResolvedValue({
        id: "app-1",
        name: "Slack",
      } as never);
      vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: "user-1" },
      ] as never); // Only 1 valid

      const result = await createSubscriptionFromCardSuggestion({
        suggestion: baseSuggestion,
        selectedUserIds: ["user-1", "user-invalid"],
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe("One or more users are invalid");
    });

    it("works when teamId is null", async () => {
      const suggestionWithoutTeam: CardTransactionSuggestion = {
        ...baseSuggestion,
        teamId: null,
        teamName: null,
        availableUsers: [],
      };

      vi.mocked(prisma.app.findFirst).mockResolvedValue({
        id: "app-1",
        name: "Slack",
      } as never);
      vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.subscription.create).mockResolvedValue({
        id: "sub-1",
      } as never);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      const result = await createSubscriptionFromCardSuggestion({
        suggestion: suggestionWithoutTeam,
        selectedUserIds: [],
      });

      expect(result.success).toBe(true);
      expect(prisma.subscription.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          teamId: null,
        }),
      });
    });

    it("records the card_transaction_suggestion source in the audit log", async () => {
      vi.mocked(prisma.app.findFirst).mockResolvedValue({
        id: "app-1",
        name: "Slack",
      } as never);
      vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.subscription.create).mockResolvedValue({
        id: "sub-1",
      } as never);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      await createSubscriptionFromCardSuggestion({
        suggestion: baseSuggestion,
        selectedUserIds: [],
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            source: "card_transaction_suggestion",
            teamId: "team-marketing",
          }),
        }),
      });
    });
  });
});

// ==================== SMP-107: improved subscription suggestion flow for CSV payment uploads ====================

describe("SMP-107: ensureAppTeamAssignment", () => {
  const mockOrgId = "org-123";
  const mockUserId = "user-123";

  beforeEach(() => {
    vi.resetAllMocks();
    mockedAuth.mockResolvedValue({
      user: {
        id: mockUserId,
        organizationId: mockOrgId,
        role: "ADMIN",
        teamId: null,
      },
      expires: "",
    });
  });

  it("does not create a new AppTeam when one already exists", async () => {
    vi.mocked(prisma.appTeam.findFirst).mockResolvedValue({
      id: "app-team-existing",
      appId: "app-1",
      teamId: "team-1",
    } as never);

    const result = await ensureAppTeamAssignment("app-1", "team-1");

    expect(result.success).toBe(true);
    expect(result.data?.created).toBe(false);
    expect(prisma.appTeam.create).not.toHaveBeenCalled();
  });

  it("creates a new AppTeam when none exists", async () => {
    vi.mocked(prisma.appTeam.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.appTeam.create).mockResolvedValue({
      id: "app-team-new",
      appId: "app-1",
      teamId: "team-1",
    } as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    const result = await ensureAppTeamAssignment("app-1", "team-1");

    expect(result.success).toBe(true);
    expect(result.data?.created).toBe(true);
    expect(prisma.appTeam.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        appId: "app-1",
        teamId: "team-1",
        assignedBy: mockUserId,
      }),
    });
  });

  it("writes an audit log on creation", async () => {
    vi.mocked(prisma.appTeam.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.appTeam.create).mockResolvedValue({
      id: "app-team-new",
      appId: "app-1",
      teamId: "team-1",
    } as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    await ensureAppTeamAssignment("app-1", "team-1");

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "ASSIGN_APP_TEAM",
        entityType: "AppTeam",
        metadata: expect.objectContaining({
          appId: "app-1",
          teamId: "team-1",
          source: "payment_suggestion_auto",
        }),
      }),
    });
  });

  it("does nothing when teamId is null", async () => {
    const result = await ensureAppTeamAssignment("app-1", null);

    expect(result.success).toBe(true);
    expect(result.data?.created).toBe(false);
    expect(prisma.appTeam.findFirst).not.toHaveBeenCalled();
    expect(prisma.appTeam.create).not.toHaveBeenCalled();
  });
});

describe("SMP-107: suggestSubscriptionsFromPayments - extended suggestion logic", () => {
  const mockOrgId = "org-123";

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(prisma.taxRate.findFirst).mockResolvedValue({
      ratePercent: 5,
    } as never);
    mockedAuth.mockResolvedValue({
      user: {
        id: "user-123",
        organizationId: mockOrgId,
        role: "ADMIN",
        teamId: null,
      },
      expires: "",
    });
  });

  it("includes suggestedAction: link when a subscription exists but some payment records are unlinked", async () => {
    vi.mocked(prisma.subscription.findMany).mockResolvedValue([
      { appId: "app-1", id: "sub-existing" },
    ] as never);

    vi.mocked(prisma.paymentRecord.groupBy).mockResolvedValue([
      {
        matchedAppId: "app-1",
        _count: { id: 3 },
        _sum: { amount: 150000 },
        _min: { transactionDate: new Date("2025-01-01") },
        _max: { transactionDate: new Date("2025-03-01") },
      },
    ] as never);

    vi.mocked(prisma.app.findUnique).mockResolvedValue({
      id: "app-1",
      name: "Slack",
      customLogoUrl: null,
      catalog: { logoUrl: "https://slack.com/logo.png" },
    } as never);

    // Some payment records are linked, some are not
    vi.mocked(prisma.paymentRecord.findMany).mockResolvedValue([
      {
        id: "pr-1",
        transactionDate: new Date("2025-01-01"),
        amount: 50000,
        currency: "KRW",
        teamId: "team-1",
        userId: null,
        linkedSubscriptionId: "sub-existing", // linked
      },
      {
        id: "pr-2",
        transactionDate: new Date("2025-02-01"),
        amount: 50000,
        currency: "KRW",
        teamId: "team-1",
        userId: null,
        linkedSubscriptionId: null, // not linked
      },
      {
        id: "pr-3",
        transactionDate: new Date("2025-03-01"),
        amount: 50000,
        currency: "KRW",
        teamId: "team-1",
        userId: null,
        linkedSubscriptionId: null, // not linked
      },
    ] as never);

    vi.mocked(prisma.team.findUnique).mockResolvedValue({
      id: "team-1",
      name: "Marketing",
      members: [],
    } as never);

    // appendUnassignedUsers: no users with teamId=null
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);

    const result = await suggestSubscriptionsFromPayments();

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data![0].suggestedAction).toBe("link");
    expect(result.data![0].existingSubscriptionId).toBe("sub-existing");
    expect(result.data![0].unmatchedPaymentIds).toEqual(["pr-2", "pr-3"]);
  });

  it("excludes the app when a subscription exists and all payment records are linked", async () => {
    vi.mocked(prisma.subscription.findMany).mockResolvedValue([
      { appId: "app-1", id: "sub-existing" },
    ] as never);

    vi.mocked(prisma.paymentRecord.groupBy).mockResolvedValue([
      {
        matchedAppId: "app-1",
        _count: { id: 2 },
        _sum: { amount: 100000 },
        _min: { transactionDate: new Date("2025-01-01") },
        _max: { transactionDate: new Date("2025-02-01") },
      },
    ] as never);

    vi.mocked(prisma.app.findUnique).mockResolvedValue({
      id: "app-1",
      name: "Slack",
      customLogoUrl: null,
      catalog: null,
    } as never);

    // All payment records are linked
    vi.mocked(prisma.paymentRecord.findMany).mockResolvedValue([
      {
        id: "pr-1",
        transactionDate: new Date("2025-01-01"),
        amount: 50000,
        currency: "KRW",
        teamId: null,
        userId: null,
        linkedSubscriptionId: "sub-existing",
      },
      {
        id: "pr-2",
        transactionDate: new Date("2025-02-01"),
        amount: 50000,
        currency: "KRW",
        teamId: null,
        userId: null,
        linkedSubscriptionId: "sub-existing",
      },
    ] as never);

    const result = await suggestSubscriptionsFromPayments();

    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });

  it("uses suggestedAction: create when no subscription exists", async () => {
    vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);

    vi.mocked(prisma.paymentRecord.groupBy).mockResolvedValue([
      {
        matchedAppId: "app-new",
        _count: { id: 3 },
        _sum: { amount: 150000 },
        _min: { transactionDate: new Date("2025-01-01") },
        _max: { transactionDate: new Date("2025-03-01") },
      },
    ] as never);

    vi.mocked(prisma.app.findUnique).mockResolvedValue({
      id: "app-new",
      name: "Notion",
      customLogoUrl: null,
      catalog: null,
    } as never);

    vi.mocked(prisma.paymentRecord.findMany).mockResolvedValue([
      {
        id: "pr-1",
        transactionDate: new Date("2025-01-01"),
        amount: 50000,
        currency: "KRW",
        teamId: null,
        userId: "user-1",
        linkedSubscriptionId: null,
      },
      {
        id: "pr-2",
        transactionDate: new Date("2025-02-01"),
        amount: 50000,
        currency: "KRW",
        teamId: null,
        userId: "user-1",
        linkedSubscriptionId: null,
      },
      {
        id: "pr-3",
        transactionDate: new Date("2025-03-01"),
        amount: 50000,
        currency: "KRW",
        teamId: null,
        userId: "user-1",
        linkedSubscriptionId: null,
      },
    ] as never);

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      name: "Ahmed Hassan",
      email: "hong@test.com",
      team: { id: "team-1", name: "Engineering" },
    } as never);

    // SMP-134: load team members (fills availableUsers when dominantUserId is set)
    vi.mocked(prisma.team.findUnique).mockResolvedValue({
      id: "team-1",
      name: "Engineering",
      members: [{ id: "user-1", name: "Ahmed Hassan", email: "hong@test.com" }],
    } as never);

    // appendUnassignedUsers: no users with teamId=null
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);

    const result = await suggestSubscriptionsFromPayments();

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data![0].suggestedAction).toBe("create");
    expect(result.data![0].existingSubscriptionId).toBeUndefined();
    expect(result.data![0].unmatchedPaymentIds).toEqual([
      "pr-1",
      "pr-2",
      "pr-3",
    ]);
  });
});

describe("SMP-107: createSubscriptionFromPaymentSuggestion - extended create/link logic", () => {
  const mockOrgId = "org-123";
  const mockUserId = "user-123";

  beforeEach(() => {
    vi.resetAllMocks();
    mockedAuth.mockResolvedValue({
      user: {
        id: mockUserId,
        organizationId: mockOrgId,
        role: "ADMIN",
        teamId: null,
      },
      expires: "",
    });
  });

  const baseSuggestion: PaymentRecordSuggestion = {
    appId: "app-1",
    appName: "Slack",
    appLogoUrl: "https://slack.com/logo.png",
    suggestedBillingCycle: "MONTHLY",
    suggestedAmount: 50000,
    currency: "KRW",
    paymentCount: 3,
    firstPaymentDate: new Date("2025-01-01"),
    lastPaymentDate: new Date("2025-03-01"),
    confidence: 0.85,
    teamId: "team-marketing",
    teamName: "Marketing",
    assignedUserId: "user-kim",
    assignedUserName: "Omar Khalid",
    availableUsers: [],
    source: "payment_record",
    suggestedAction: "create",
    unmatchedPaymentIds: ["pr-1", "pr-2", "pr-3"],
    // SMP-134: seat-based subscription detection
    billingType: "PER_SEAT",
    perSeatPrice: null,
    suggestedSeats: null,
  };

  it("creates a new subscription and links PaymentRecords for suggestedAction: create", async () => {
    vi.mocked(prisma.app.findFirst).mockResolvedValue({
      id: "app-1",
      name: "Slack",
    } as never);
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.appTeam.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.appTeam.create).mockResolvedValue({
      id: "app-team-new",
    } as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: "user-kim" },
    ] as never);
    vi.mocked(prisma.subscription.create).mockResolvedValue({
      id: "sub-new",
    } as never);
    vi.mocked(prisma.subscriptionUser.createMany).mockResolvedValue({
      count: 1,
    } as never);
    vi.mocked(prisma.paymentRecord.updateMany).mockResolvedValue({
      count: 3,
    } as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    const result = await createSubscriptionFromPaymentSuggestion({
      suggestion: baseSuggestion,
      selectedUserIds: [],
    });

    expect(result.success).toBe(true);
    expect(prisma.subscription.create).toHaveBeenCalled();
    expect(prisma.paymentRecord.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["pr-1", "pr-2", "pr-3"] } },
      data: { linkedSubscriptionId: "sub-new" },
    });
  });

  it("only links to the existing subscription without creating one for suggestedAction: link", async () => {
    const linkSuggestion: PaymentRecordSuggestion = {
      ...baseSuggestion,
      suggestedAction: "link",
      existingSubscriptionId: "sub-existing",
      unmatchedPaymentIds: ["pr-2", "pr-3"],
    };

    vi.mocked(prisma.app.findFirst).mockResolvedValue({
      id: "app-1",
      name: "Slack",
    } as never);
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
      id: "sub-existing",
    } as never);
    vi.mocked(prisma.paymentRecord.updateMany).mockResolvedValue({
      count: 2,
    } as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    const result = await createSubscriptionFromPaymentSuggestion({
      suggestion: linkSuggestion,
      selectedUserIds: [],
    });

    expect(result.success).toBe(true);
    expect(result.data?.id).toBe("sub-existing");
    expect(prisma.subscription.create).not.toHaveBeenCalled();
    expect(prisma.paymentRecord.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["pr-2", "pr-3"] } },
      data: { linkedSubscriptionId: "sub-existing" },
    });
  });

  it("performs App-Team auto-assignment", async () => {
    vi.mocked(prisma.app.findFirst).mockResolvedValue({
      id: "app-1",
      name: "Slack",
    } as never);
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.appTeam.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.appTeam.create).mockResolvedValue({
      id: "app-team-new",
    } as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: "user-kim" },
    ] as never);
    vi.mocked(prisma.subscription.create).mockResolvedValue({
      id: "sub-new",
    } as never);
    vi.mocked(prisma.subscriptionUser.createMany).mockResolvedValue({
      count: 1,
    } as never);
    vi.mocked(prisma.paymentRecord.updateMany).mockResolvedValue({
      count: 3,
    } as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    await createSubscriptionFromPaymentSuggestion({
      suggestion: baseSuggestion,
      selectedUserIds: [],
    });

    expect(prisma.appTeam.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        appId: "app-1",
        teamId: "team-marketing",
      }),
    });
  });

  it("applies skipDuplicates: true when creating SubscriptionUser records", async () => {
    vi.mocked(prisma.app.findFirst).mockResolvedValue({
      id: "app-1",
      name: "Slack",
    } as never);
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.appTeam.findFirst).mockResolvedValue({
      id: "app-team-existing",
    } as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: "user-kim" },
      { id: "user-lee" },
    ] as never);
    vi.mocked(prisma.subscription.create).mockResolvedValue({
      id: "sub-new",
    } as never);
    vi.mocked(prisma.subscriptionUser.createMany).mockResolvedValue({
      count: 2,
    } as never);
    vi.mocked(prisma.paymentRecord.updateMany).mockResolvedValue({
      count: 3,
    } as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    await createSubscriptionFromPaymentSuggestion({
      suggestion: baseSuggestion,
      selectedUserIds: ["user-lee"],
    });

    expect(prisma.subscriptionUser.createMany).toHaveBeenCalledWith({
      data: expect.any(Array),
      skipDuplicates: true,
    });
  });

  it("auto-assigns assignedUserId to SubscriptionUser when present", async () => {
    vi.mocked(prisma.app.findFirst).mockResolvedValue({
      id: "app-1",
      name: "Slack",
    } as never);
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.appTeam.findFirst).mockResolvedValue({
      id: "app-team-existing",
    } as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: "user-kim" },
    ] as never);
    vi.mocked(prisma.subscription.create).mockResolvedValue({
      id: "sub-new",
    } as never);
    vi.mocked(prisma.subscriptionUser.createMany).mockResolvedValue({
      count: 1,
    } as never);
    vi.mocked(prisma.paymentRecord.updateMany).mockResolvedValue({
      count: 3,
    } as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    await createSubscriptionFromPaymentSuggestion({
      suggestion: baseSuggestion,
      selectedUserIds: [], // no manual selection
    });

    // assignedUserId should be included automatically
    expect(prisma.subscriptionUser.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ userId: "user-kim" }),
      ]),
      skipDuplicates: true,
    });
  });
});

// SMP-134: always populate availableUsers
describe("SMP-134: availableUsers population fix", () => {
  const mockOrgId = "org-123";

  beforeEach(() => {
    vi.resetAllMocks();
    mockedAuth.mockResolvedValue({
      user: {
        id: "user-123",
        organizationId: mockOrgId,
        role: "ADMIN",
        teamId: null,
      },
      expires: "",
    });
  });

  describe("suggestSubscriptionsFromPayments - populating availableUsers when dominantUserId is set", () => {
    it("fills availableUsers with team members when dominantUserId has a team", async () => {
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);

      vi.mocked(prisma.paymentRecord.groupBy).mockResolvedValue([
        {
          matchedAppId: "app-1",
          _count: { id: 3 },
          _sum: { amount: 150000 },
          _min: { transactionDate: new Date("2025-01-01") },
          _max: { transactionDate: new Date("2025-03-01") },
        },
      ] as never);

      vi.mocked(prisma.app.findUnique).mockResolvedValue({
        id: "app-1",
        name: "Slack",
        customLogoUrl: null,
        catalog: null,
      } as never);

      vi.mocked(prisma.paymentRecord.findMany).mockResolvedValue([
        {
          id: "pr-1",
          transactionDate: new Date("2025-01-01"),
          amount: 50000,
          currency: "KRW",
          teamId: null,
          userId: "user-kim",
          linkedSubscriptionId: null,
        },
        {
          id: "pr-2",
          transactionDate: new Date("2025-02-01"),
          amount: 50000,
          currency: "KRW",
          teamId: null,
          userId: "user-kim",
          linkedSubscriptionId: null,
        },
        {
          id: "pr-3",
          transactionDate: new Date("2025-03-01"),
          amount: 50000,
          currency: "KRW",
          teamId: null,
          userId: "user-kim",
          linkedSubscriptionId: null,
        },
      ] as never);

      // Load the dominant user
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user-kim",
        name: "Omar Khalid",
        email: "kim@test.com",
        team: { id: "team-dev", name: "Engineering" },
      } as never);

      // Load team members (query added in SMP-134)
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: "team-dev",
        name: "Engineering",
        members: [
          { id: "user-kim", name: "Omar Khalid", email: "kim@test.com" },
          { id: "user-lee", name: "Sara Ali", email: "lee@test.com" },
        ],
      } as never);

      // appendUnassignedUsers: no users with teamId=null
      vi.mocked(prisma.user.findMany).mockResolvedValue([]);

      const result = await suggestSubscriptionsFromPayments();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].assignedUserId).toBe("user-kim");
      expect(result.data![0].teamId).toBe("team-dev");
      // SMP-134: availableUsers should be filled with team members
      expect(result.data![0].availableUsers).toHaveLength(2);
      expect(result.data![0].availableUsers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "user-kim" }),
          expect.objectContaining({ id: "user-lee" }),
        ])
      );
    });

    it("falls back to all organization members when dominantUserId has no team", async () => {
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);

      vi.mocked(prisma.paymentRecord.groupBy).mockResolvedValue([
        {
          matchedAppId: "app-1",
          _count: { id: 3 },
          _sum: { amount: 150000 },
          _min: { transactionDate: new Date("2025-01-01") },
          _max: { transactionDate: new Date("2025-03-01") },
        },
      ] as never);

      vi.mocked(prisma.app.findUnique).mockResolvedValue({
        id: "app-1",
        name: "Slack",
        customLogoUrl: null,
        catalog: null,
      } as never);

      vi.mocked(prisma.paymentRecord.findMany).mockResolvedValue([
        {
          id: "pr-1",
          transactionDate: new Date("2025-01-01"),
          amount: 50000,
          currency: "KRW",
          teamId: null,
          userId: "user-solo",
          linkedSubscriptionId: null,
        },
        {
          id: "pr-2",
          transactionDate: new Date("2025-02-01"),
          amount: 50000,
          currency: "KRW",
          teamId: null,
          userId: "user-solo",
          linkedSubscriptionId: null,
        },
        {
          id: "pr-3",
          transactionDate: new Date("2025-03-01"),
          amount: 50000,
          currency: "KRW",
          teamId: null,
          userId: "user-solo",
          linkedSubscriptionId: null,
        },
      ] as never);

      // User has no team
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user-solo",
        name: "Solo User",
        email: "solo@test.com",
        team: null,
      } as never);

      // Fall back to all organization members
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: "user-solo", name: "Solo User", email: "solo@test.com" },
        { id: "user-other", name: "Other User", email: "other@test.com" },
      ] as never);

      const result = await suggestSubscriptionsFromPayments();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].assignedUserId).toBe("user-solo");
      expect(result.data![0].teamId).toBeNull();
      // SMP-134: availableUsers should be filled with all organization members
      expect(result.data![0].availableUsers).toHaveLength(2);
    });
  });

  describe("suggestFromCardTransactions - populating availableUsers when assignedUser is set", () => {
    it("fills availableUsers with the card assignedUser's team members", async () => {
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);

      vi.mocked(prisma.cardTransaction.groupBy)
        .mockResolvedValueOnce([
          {
            matchedAppId: "app-1",
            _count: { id: 3 },
            _sum: { useAmt: 150000 },
            _min: { useDt: "20250101" },
            _max: { useDt: "20250301" },
          },
        ] as never)
        .mockResolvedValueOnce([
          { corporateCardId: "card-1", _count: { id: 3 } },
        ] as never);

      vi.mocked(prisma.app.findUnique).mockResolvedValue({
        id: "app-1",
        name: "Slack",
        customLogoUrl: null,
        catalog: null,
      } as never);

      vi.mocked(prisma.corporateCard.findUnique).mockResolvedValue({
        id: "card-1",
        team: null,
        assignedUser: {
          id: "user-kim",
          name: "Omar Khalid",
          email: "kim@test.com",
          team: { id: "team-dev", name: "Engineering" },
        },
      } as never);

      // SMP-134: load team members
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: "team-dev",
        name: "Engineering",
        members: [
          { id: "user-kim", name: "Omar Khalid", email: "kim@test.com" },
          { id: "user-park", name: "Khalid Mansour", email: "park@test.com" },
        ],
      } as never);

      vi.mocked(prisma.cardTransaction.findMany).mockResolvedValue([
        {
          id: "tx-1",
          useDt: "20250101",
          useAmt: 50000,
          teamId: null,
          userId: null,
          linkedSubscriptionId: null,
        },
        {
          id: "tx-2",
          useDt: "20250201",
          useAmt: 50000,
          teamId: null,
          userId: null,
          linkedSubscriptionId: null,
        },
        {
          id: "tx-3",
          useDt: "20250301",
          useAmt: 50000,
          teamId: null,
          userId: null,
          linkedSubscriptionId: null,
        },
      ] as never);

      // appendUnassignedUsers: no users with teamId=null
      vi.mocked(prisma.user.findMany).mockResolvedValue([]);

      const result = await suggestFromCardTransactions();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].assignedUserId).toBe("user-kim");
      expect(result.data![0].teamId).toBe("team-dev");
      // SMP-134: availableUsers should be filled with team members
      expect(result.data![0].availableUsers).toHaveLength(2);
      expect(result.data![0].availableUsers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "user-kim" }),
          expect.objectContaining({ id: "user-park" }),
        ])
      );
    });

    it("falls back to all organization members when the card assignedUser has no team", async () => {
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);

      vi.mocked(prisma.cardTransaction.groupBy)
        .mockResolvedValueOnce([
          {
            matchedAppId: "app-1",
            _count: { id: 3 },
            _sum: { useAmt: 150000 },
            _min: { useDt: "20250101" },
            _max: { useDt: "20250301" },
          },
        ] as never)
        .mockResolvedValueOnce([
          { corporateCardId: "card-1", _count: { id: 3 } },
        ] as never);

      vi.mocked(prisma.app.findUnique).mockResolvedValue({
        id: "app-1",
        name: "Slack",
        customLogoUrl: null,
        catalog: null,
      } as never);

      // User has no team
      vi.mocked(prisma.corporateCard.findUnique).mockResolvedValue({
        id: "card-1",
        team: null,
        assignedUser: {
          id: "user-solo",
          name: "Solo User",
          email: "solo@test.com",
          team: null,
        },
      } as never);

      // SMP-134: fall back to all organization members
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: "user-solo", name: "Solo User", email: "solo@test.com" },
        { id: "user-other", name: "Other User", email: "other@test.com" },
      ] as never);

      vi.mocked(prisma.cardTransaction.findMany).mockResolvedValue([
        {
          id: "tx-1",
          useDt: "20250101",
          useAmt: 50000,
          teamId: null,
          userId: null,
          linkedSubscriptionId: null,
        },
        {
          id: "tx-2",
          useDt: "20250201",
          useAmt: 50000,
          teamId: null,
          userId: null,
          linkedSubscriptionId: null,
        },
        {
          id: "tx-3",
          useDt: "20250301",
          useAmt: 50000,
          teamId: null,
          userId: null,
          linkedSubscriptionId: null,
        },
      ] as never);

      const result = await suggestFromCardTransactions();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].assignedUserId).toBe("user-solo");
      expect(result.data![0].teamId).toBeNull();
      // SMP-134: availableUsers should be filled with all organization members
      expect(result.data![0].availableUsers).toHaveLength(2);
    });
  });
});

// SMP-199: availableUsers include teamId/teamName
describe("SMP-199: availableUsers include teamId/teamName", () => {
  const mockOrgId = "org-123";

  beforeEach(() => {
    vi.resetAllMocks();
    mockedAuth.mockResolvedValue({
      user: {
        id: "user-123",
        organizationId: mockOrgId,
        role: "ADMIN",
        teamId: null,
      },
      expires: "",
    });
  });

  describe("suggestSubscriptionsFromPayments - availableUsers include teamId/teamName", () => {
    it("includes teamId and teamName in availableUsers entries for team members", async () => {
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);

      vi.mocked(prisma.paymentRecord.groupBy).mockResolvedValue([
        {
          matchedAppId: "app-1",
          _count: { id: 3 },
          _sum: { amount: 150000 },
          _min: { transactionDate: new Date("2025-01-01") },
          _max: { transactionDate: new Date("2025-03-01") },
        },
      ] as never);

      vi.mocked(prisma.app.findUnique).mockResolvedValue({
        id: "app-1",
        name: "Slack",
        customLogoUrl: null,
        catalog: null,
      } as never);

      vi.mocked(prisma.paymentRecord.findMany).mockResolvedValue([
        {
          id: "pr-1",
          transactionDate: new Date("2025-01-01"),
          amount: 50000,
          currency: "KRW",
          teamId: null,
          userId: "user-kim",
          linkedSubscriptionId: null,
        },
        {
          id: "pr-2",
          transactionDate: new Date("2025-02-01"),
          amount: 50000,
          currency: "KRW",
          teamId: null,
          userId: "user-kim",
          linkedSubscriptionId: null,
        },
        {
          id: "pr-3",
          transactionDate: new Date("2025-03-01"),
          amount: 50000,
          currency: "KRW",
          teamId: null,
          userId: "user-kim",
          linkedSubscriptionId: null,
        },
      ] as never);

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user-kim",
        name: "Omar Khalid",
        email: "kim@test.com",
        team: { id: "team-dev", name: "Engineering" },
      } as never);

      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: "team-dev",
        name: "Engineering",
        members: [
          { id: "user-kim", name: "Omar Khalid", email: "kim@test.com" },
          { id: "user-lee", name: "Sara Ali", email: "lee@test.com" },
        ],
      } as never);

      // appendUnassignedUsers: no users with teamId=null
      vi.mocked(prisma.user.findMany).mockResolvedValue([]);

      const result = await suggestSubscriptionsFromPayments();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      const users = result.data![0].availableUsers;
      expect(users).toHaveLength(2);
      // SMP-199: team members must have non-null teamId and teamName
      users.forEach((user) => {
        expect(user).toHaveProperty("teamId");
        expect(user).toHaveProperty("teamName");
        expect(user.teamId).toBe("team-dev");
        expect(user.teamName).toBe("Engineering");
      });
    });

    it("sets teamId and teamName to null in availableUsers entries for users without a team (fallback)", async () => {
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);

      vi.mocked(prisma.paymentRecord.groupBy).mockResolvedValue([
        {
          matchedAppId: "app-1",
          _count: { id: 3 },
          _sum: { amount: 150000 },
          _min: { transactionDate: new Date("2025-01-01") },
          _max: { transactionDate: new Date("2025-03-01") },
        },
      ] as never);

      vi.mocked(prisma.app.findUnique).mockResolvedValue({
        id: "app-1",
        name: "Slack",
        customLogoUrl: null,
        catalog: null,
      } as never);

      vi.mocked(prisma.paymentRecord.findMany).mockResolvedValue([
        {
          id: "pr-1",
          transactionDate: new Date("2025-01-01"),
          amount: 50000,
          currency: "KRW",
          teamId: null,
          userId: "user-solo",
          linkedSubscriptionId: null,
        },
        {
          id: "pr-2",
          transactionDate: new Date("2025-02-01"),
          amount: 50000,
          currency: "KRW",
          teamId: null,
          userId: "user-solo",
          linkedSubscriptionId: null,
        },
        {
          id: "pr-3",
          transactionDate: new Date("2025-03-01"),
          amount: 50000,
          currency: "KRW",
          teamId: null,
          userId: "user-solo",
          linkedSubscriptionId: null,
        },
      ] as never);

      // User has no team
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user-solo",
        name: "Solo User",
        email: "solo@test.com",
        team: null,
      } as never);

      // Fall back to all organization members (no team)
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: "user-solo", name: "Solo User", email: "solo@test.com" },
        { id: "user-other", name: "Other User", email: "other@test.com" },
      ] as never);

      const result = await suggestSubscriptionsFromPayments();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      const users = result.data![0].availableUsers;
      expect(users).toHaveLength(2);
      // SMP-199: users without a team must have null teamId and teamName
      users.forEach((user) => {
        expect(user).toHaveProperty("teamId");
        expect(user).toHaveProperty("teamName");
        expect(user.teamId).toBeNull();
        expect(user.teamName).toBeNull();
      });
    });
  });

  describe("suggestFromCardTransactions - availableUsers include teamId/teamName", () => {
    it("includes teamId and teamName in availableUsers entries for card team members", async () => {
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);

      vi.mocked(prisma.cardTransaction.groupBy)
        .mockResolvedValueOnce([
          {
            matchedAppId: "app-1",
            _count: { id: 3 },
            _sum: { useAmt: 150000 },
            _min: { useDt: "20250101" },
            _max: { useDt: "20250301" },
          },
        ] as never)
        .mockResolvedValueOnce([
          { corporateCardId: "card-1", _count: { id: 3 } },
        ] as never);

      vi.mocked(prisma.app.findUnique).mockResolvedValue({
        id: "app-1",
        name: "Slack",
        customLogoUrl: null,
        catalog: { logoUrl: "https://slack.com/logo.png" },
      } as never);

      vi.mocked(prisma.corporateCard.findUnique).mockResolvedValue({
        id: "card-1",
        team: {
          id: "team-marketing",
          name: "Marketing",
          members: [
            { id: "user-1", name: "Ahmed Hassan", email: "hong@test.com" },
            { id: "user-2", name: "Omar Khalid", email: "kim@test.com" },
          ],
        },
        assignedUser: null,
      } as never);

      vi.mocked(prisma.cardTransaction.findMany).mockResolvedValue([
        {
          id: "tx-1",
          useDt: "20250101",
          useAmt: 50000,
          teamId: null,
          userId: null,
          linkedSubscriptionId: null,
        },
        {
          id: "tx-2",
          useDt: "20250201",
          useAmt: 50000,
          teamId: null,
          userId: null,
          linkedSubscriptionId: null,
        },
        {
          id: "tx-3",
          useDt: "20250301",
          useAmt: 50000,
          teamId: null,
          userId: null,
          linkedSubscriptionId: null,
        },
      ] as never);

      // appendUnassignedUsers: no users with teamId=null
      vi.mocked(prisma.user.findMany).mockResolvedValue([]);

      const result = await suggestFromCardTransactions();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      const users = result.data![0].availableUsers;
      expect(users).toHaveLength(2);
      // SMP-199: team members must have non-null teamId and teamName
      users.forEach((user) => {
        expect(user).toHaveProperty("teamId");
        expect(user).toHaveProperty("teamName");
        expect(user.teamId).toBe("team-marketing");
        expect(user.teamName).toBe("Marketing");
      });
    });

    it("sets teamId and teamName to null in availableUsers entries for fallback users when the card has no team", async () => {
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);

      vi.mocked(prisma.cardTransaction.groupBy)
        .mockResolvedValueOnce([
          {
            matchedAppId: "app-1",
            _count: { id: 3 },
            _sum: { useAmt: 150000 },
            _min: { useDt: "20250101" },
            _max: { useDt: "20250301" },
          },
        ] as never)
        .mockResolvedValueOnce([
          { corporateCardId: "card-1", _count: { id: 3 } },
        ] as never);

      vi.mocked(prisma.app.findUnique).mockResolvedValue({
        id: "app-1",
        name: "Slack",
        customLogoUrl: null,
        catalog: null,
      } as never);

      vi.mocked(prisma.corporateCard.findUnique).mockResolvedValue({
        id: "card-1",
        team: null,
        assignedUser: null,
      } as never);

      vi.mocked(prisma.cardTransaction.findMany).mockResolvedValue([
        {
          id: "tx-1",
          useDt: "20250101",
          useAmt: 50000,
          teamId: null,
          userId: null,
          linkedSubscriptionId: null,
        },
        {
          id: "tx-2",
          useDt: "20250201",
          useAmt: 50000,
          teamId: null,
          userId: null,
          linkedSubscriptionId: null,
        },
        {
          id: "tx-3",
          useDt: "20250301",
          useAmt: 50000,
          teamId: null,
          userId: null,
          linkedSubscriptionId: null,
        },
      ] as never);

      // SMP-156: fall back to all organization members (no team)
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: "user-1", name: "User 1", email: "user1@test.com" },
        { id: "user-2", name: "User 2", email: "user2@test.com" },
      ] as never);

      const result = await suggestFromCardTransactions();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      const users = result.data![0].availableUsers;
      expect(users).toHaveLength(2);
      // SMP-199: users without a team must have null teamId and teamName
      users.forEach((user) => {
        expect(user).toHaveProperty("teamId");
        expect(user).toHaveProperty("teamName");
        expect(user.teamId).toBeNull();
        expect(user.teamName).toBeNull();
      });
    });
  });
});

// SMP-134: verify assignedUserId is always included in availableUsers
describe("SMP-134: assignedUserId inclusion guarantee in availableUsers", () => {
  const mockOrgId = "org-123";

  beforeEach(() => {
    vi.resetAllMocks();
    mockedAuth.mockResolvedValue({
      user: {
        id: "user-123",
        organizationId: mockOrgId,
        role: "ADMIN",
        teamId: null,
      },
      expires: "",
    });
  });

  it("suggestSubscriptionsFromPayments: includes assignedUserId in availableUsers even when missing from team members", async () => {
    vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);

    vi.mocked(prisma.paymentRecord.groupBy).mockResolvedValue([
      {
        matchedAppId: "app-1",
        _count: { id: 3 },
        _sum: { amount: 150000 },
        _min: { transactionDate: new Date("2025-01-01") },
        _max: { transactionDate: new Date("2025-03-01") },
      },
    ] as never);

    vi.mocked(prisma.app.findUnique).mockResolvedValue({
      id: "app-1",
      name: "Slack",
      customLogoUrl: null,
      catalog: null,
    } as never);

    vi.mocked(prisma.paymentRecord.findMany).mockResolvedValue([
      {
        id: "pr-1",
        transactionDate: new Date("2025-01-01"),
        amount: 50000,
        currency: "KRW",
        teamId: null,
        userId: "user-kim",
        linkedSubscriptionId: null,
      },
      {
        id: "pr-2",
        transactionDate: new Date("2025-02-01"),
        amount: 50000,
        currency: "KRW",
        teamId: null,
        userId: "user-kim",
        linkedSubscriptionId: null,
      },
      {
        id: "pr-3",
        transactionDate: new Date("2025-03-01"),
        amount: 50000,
        currency: "KRW",
        teamId: null,
        userId: "user-kim",
        linkedSubscriptionId: null,
      },
    ] as never);

    // The dominant user has a team, but is missing from the team member list
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-kim",
      name: "Omar Khalid",
      email: "kim@test.com",
      team: { id: "team-dev", name: "Engineering" },
    } as never);

    vi.mocked(prisma.team.findUnique).mockResolvedValue({
      id: "team-dev",
      name: "Engineering",
      members: [
        // user-kim is missing from the member list (e.g. after a status change)
        { id: "user-lee", name: "Sara Ali", email: "lee@test.com" },
      ],
    } as never);

    // appendUnassignedUsers: no users with teamId=null
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);

    const result = await suggestSubscriptionsFromPayments();

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data![0].assignedUserId).toBe("user-kim");
    // assignedUserId must be included in availableUsers
    expect(
      result.data![0].availableUsers.some((u) => u.id === "user-kim")
    ).toBe(true);
    // Existing team members are also included
    expect(
      result.data![0].availableUsers.some((u) => u.id === "user-lee")
    ).toBe(true);
  });

  it("suggestFromCardTransactions: includes assignedUserId in availableUsers even when missing from team members", async () => {
    vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);

    vi.mocked(prisma.cardTransaction.groupBy)
      .mockResolvedValueOnce([
        {
          matchedAppId: "app-1",
          _count: { id: 3 },
          _sum: { useAmt: 150000 },
          _min: { useDt: "20250101" },
          _max: { useDt: "20250301" },
        },
      ] as never)
      .mockResolvedValueOnce([
        { corporateCardId: "card-1", _count: { id: 3 } },
      ] as never);

    vi.mocked(prisma.app.findUnique).mockResolvedValue({
      id: "app-1",
      name: "Slack",
      customLogoUrl: null,
      catalog: null,
    } as never);

    vi.mocked(prisma.corporateCard.findUnique).mockResolvedValue({
      id: "card-1",
      team: null,
      assignedUser: {
        id: "user-kim",
        name: "Omar Khalid",
        email: "kim@test.com",
        team: { id: "team-dev", name: "Engineering" },
      },
    } as never);

    // assignedUser is missing from the team members
    vi.mocked(prisma.team.findUnique).mockResolvedValue({
      id: "team-dev",
      name: "Engineering",
      members: [
        { id: "user-park", name: "Khalid Mansour", email: "park@test.com" },
      ],
    } as never);

    // Load assignedUser on its own (safety fallback)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-kim",
      name: "Omar Khalid",
      email: "kim@test.com",
    } as never);

    vi.mocked(prisma.cardTransaction.findMany).mockResolvedValue([
      {
        id: "tx-1",
        useDt: "20250101",
        useAmt: 50000,
        teamId: null,
        userId: null,
        linkedSubscriptionId: null,
      },
      {
        id: "tx-2",
        useDt: "20250201",
        useAmt: 50000,
        teamId: null,
        userId: null,
        linkedSubscriptionId: null,
      },
      {
        id: "tx-3",
        useDt: "20250301",
        useAmt: 50000,
        teamId: null,
        userId: null,
        linkedSubscriptionId: null,
      },
    ] as never);

    // appendUnassignedUsers: no users with teamId=null
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);

    const result = await suggestFromCardTransactions();

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data![0].assignedUserId).toBe("user-kim");
    // assignedUserId must be included in availableUsers
    expect(
      result.data![0].availableUsers.some((u) => u.id === "user-kim")
    ).toBe(true);
    // Existing team members are also included
    expect(
      result.data![0].availableUsers.some((u) => u.id === "user-park")
    ).toBe(true);
  });
});

// SMP-156: regression - fall back to all organization members when no team/user is assigned
describe("SMP-156: availableUsers fallback to org members when no team/user assigned", () => {
  const mockOrgId = "org-123";

  beforeEach(() => {
    vi.resetAllMocks();
    mockedAuth.mockResolvedValue({
      user: {
        id: "user-123",
        organizationId: mockOrgId,
        role: "ADMIN",
        teamId: null,
      },
      expires: "",
    });
  });

  describe("suggestSubscriptionsFromPayments - when dominantUserId and dominantTeamId are both null", () => {
    it("includes all active organization members in availableUsers when payment records have no team/user", async () => {
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);

      vi.mocked(prisma.paymentRecord.groupBy).mockResolvedValue([
        {
          matchedAppId: "app-1",
          _count: { id: 3 },
          _sum: { amount: 150000 },
          _min: { transactionDate: new Date("2025-01-01") },
          _max: { transactionDate: new Date("2025-03-01") },
        },
      ] as never);

      vi.mocked(prisma.app.findUnique).mockResolvedValue({
        id: "app-1",
        name: "Slack",
        customLogoUrl: null,
        catalog: null,
      } as never);

      // Payment records have both teamId and userId null
      vi.mocked(prisma.paymentRecord.findMany).mockResolvedValue([
        {
          id: "pr-1",
          transactionDate: new Date("2025-01-01"),
          amount: 50000,
          currency: "KRW",
          teamId: null,
          userId: null,
          linkedSubscriptionId: null,
        },
        {
          id: "pr-2",
          transactionDate: new Date("2025-02-01"),
          amount: 50000,
          currency: "KRW",
          teamId: null,
          userId: null,
          linkedSubscriptionId: null,
        },
        {
          id: "pr-3",
          transactionDate: new Date("2025-03-01"),
          amount: 50000,
          currency: "KRW",
          teamId: null,
          userId: null,
          linkedSubscriptionId: null,
        },
      ] as never);

      // Mock all active organization members
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: "user-a", name: "User A", email: "a@test.com" },
        { id: "user-b", name: "User B", email: "b@test.com" },
        { id: "user-c", name: "User C", email: "c@test.com" },
      ] as never);

      const result = await suggestSubscriptionsFromPayments();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      // No team/user assigned, so teamId and assignedUserId are null
      expect(result.data![0].teamId).toBeNull();
      expect(result.data![0].assignedUserId).toBeNull();
      // SMP-156 fix: availableUsers must include all organization members
      expect(result.data![0].availableUsers).toHaveLength(3);
      expect(result.data![0].availableUsers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "user-a" }),
          expect.objectContaining({ id: "user-b" }),
          expect.objectContaining({ id: "user-c" }),
        ])
      );
    });

    it("keeps existing behaviour: fills with team members when dominantUserId is set", async () => {
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);

      vi.mocked(prisma.paymentRecord.groupBy).mockResolvedValue([
        {
          matchedAppId: "app-1",
          _count: { id: 3 },
          _sum: { amount: 150000 },
          _min: { transactionDate: new Date("2025-01-01") },
          _max: { transactionDate: new Date("2025-03-01") },
        },
      ] as never);

      vi.mocked(prisma.app.findUnique).mockResolvedValue({
        id: "app-1",
        name: "Slack",
        customLogoUrl: null,
        catalog: null,
      } as never);

      // Payment records have a userId
      vi.mocked(prisma.paymentRecord.findMany).mockResolvedValue([
        {
          id: "pr-1",
          transactionDate: new Date("2025-01-01"),
          amount: 50000,
          currency: "KRW",
          teamId: null,
          userId: "user-kim",
          linkedSubscriptionId: null,
        },
        {
          id: "pr-2",
          transactionDate: new Date("2025-02-01"),
          amount: 50000,
          currency: "KRW",
          teamId: null,
          userId: "user-kim",
          linkedSubscriptionId: null,
        },
        {
          id: "pr-3",
          transactionDate: new Date("2025-03-01"),
          amount: 50000,
          currency: "KRW",
          teamId: null,
          userId: "user-kim",
          linkedSubscriptionId: null,
        },
      ] as never);

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user-kim",
        name: "Omar Khalid",
        email: "kim@test.com",
        team: { id: "team-dev", name: "Engineering" },
      } as never);

      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: "team-dev",
        name: "Engineering",
        members: [
          { id: "user-kim", name: "Omar Khalid", email: "kim@test.com" },
          { id: "user-lee", name: "Sara Ali", email: "lee@test.com" },
        ],
      } as never);

      // appendUnassignedUsers: no users with teamId=null
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([]);

      const result = await suggestSubscriptionsFromPayments();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].assignedUserId).toBe("user-kim");
      // Existing behaviour: fill availableUsers with team members
      expect(result.data![0].availableUsers).toHaveLength(2);
      // user.findMany is called once for appendUnassignedUsers (not the organization-wide fallback)
      expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe("suggestFromCardTransactions - card and transactions without team/user assignment", () => {
    it("includes all active organization members in availableUsers when neither the card nor the transactions have a team/user", async () => {
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);

      vi.mocked(prisma.cardTransaction.groupBy)
        .mockResolvedValueOnce([
          {
            matchedAppId: "app-1",
            _count: { id: 3 },
            _sum: { useAmt: 150000 },
            _min: { useDt: "20250101" },
            _max: { useDt: "20250301" },
          },
        ] as never)
        .mockResolvedValueOnce([
          { corporateCardId: "card-1", _count: { id: 3 } },
        ] as never);

      vi.mocked(prisma.app.findUnique).mockResolvedValue({
        id: "app-1",
        name: "Slack",
        customLogoUrl: null,
        catalog: null,
      } as never);

      // Card has no team/user
      vi.mocked(prisma.corporateCard.findUnique).mockResolvedValue({
        id: "card-1",
        team: null,
        assignedUser: null,
      } as never);

      // Transactions also have teamId/userId null
      vi.mocked(prisma.cardTransaction.findMany).mockResolvedValue([
        {
          id: "tx-1",
          useDt: "20250101",
          useAmt: 50000,
          teamId: null,
          userId: null,
          linkedSubscriptionId: null,
        },
        {
          id: "tx-2",
          useDt: "20250201",
          useAmt: 50000,
          teamId: null,
          userId: null,
          linkedSubscriptionId: null,
        },
        {
          id: "tx-3",
          useDt: "20250301",
          useAmt: 50000,
          teamId: null,
          userId: null,
          linkedSubscriptionId: null,
        },
      ] as never);

      // Mock all active organization members
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: "user-a", name: "User A", email: "a@test.com" },
        { id: "user-b", name: "User B", email: "b@test.com" },
      ] as never);

      const result = await suggestFromCardTransactions();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      // No team/user assigned, so everything is null
      expect(result.data![0].teamId).toBeNull();
      expect(result.data![0].assignedUserId).toBeNull();
      // SMP-156 fix: availableUsers must include all organization members
      expect(result.data![0].availableUsers).toHaveLength(2);
      expect(result.data![0].availableUsers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "user-a" }),
          expect.objectContaining({ id: "user-b" }),
        ])
      );
    });

    it("keeps existing behaviour: fills availableUsers with the team members when the card has a team", async () => {
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);

      vi.mocked(prisma.cardTransaction.groupBy)
        .mockResolvedValueOnce([
          {
            matchedAppId: "app-1",
            _count: { id: 3 },
            _sum: { useAmt: 150000 },
            _min: { useDt: "20250101" },
            _max: { useDt: "20250301" },
          },
        ] as never)
        .mockResolvedValueOnce([
          { corporateCardId: "card-1", _count: { id: 3 } },
        ] as never);

      vi.mocked(prisma.app.findUnique).mockResolvedValue({
        id: "app-1",
        name: "Slack",
        customLogoUrl: null,
        catalog: null,
      } as never);

      // Card has a team assigned
      vi.mocked(prisma.corporateCard.findUnique).mockResolvedValue({
        id: "card-1",
        team: {
          id: "team-marketing",
          name: "Marketing",
          members: [
            { id: "user-1", name: "Ahmed Hassan", email: "hong@test.com" },
            { id: "user-2", name: "Omar Khalid", email: "kim@test.com" },
          ],
        },
        assignedUser: null,
      } as never);

      vi.mocked(prisma.cardTransaction.findMany).mockResolvedValue([
        {
          id: "tx-1",
          useDt: "20250101",
          useAmt: 50000,
          teamId: null,
          userId: null,
          linkedSubscriptionId: null,
        },
        {
          id: "tx-2",
          useDt: "20250201",
          useAmt: 50000,
          teamId: null,
          userId: null,
          linkedSubscriptionId: null,
        },
        {
          id: "tx-3",
          useDt: "20250301",
          useAmt: 50000,
          teamId: null,
          userId: null,
          linkedSubscriptionId: null,
        },
      ] as never);

      // appendUnassignedUsers: no users with teamId=null
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([]);

      const result = await suggestFromCardTransactions();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].teamId).toBe("team-marketing");
      // Existing behaviour: fill with team members
      expect(result.data![0].availableUsers).toHaveLength(2);
      // user.findMany is called once for appendUnassignedUsers (not the organization-wide fallback)
      expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
    });
  });
});

// Phase 2: auto-assign subscriptions when a corporate card has an assigned user
describe("subscription-suggestions (Phase 2 - User Assignment)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRedirect.mockClear();
  });

  describe("suggestFromCardTransactions - assignedUser handling", () => {
    const mockOrgId = "org-123";

    beforeEach(() => {
      mockedAuth.mockResolvedValue({
        user: {
          id: "user-123",
          organizationId: mockOrgId,
          role: "ADMIN",
          teamId: null,
        },
        expires: "",
      });
    });

    it("includes assignedUserId and user details when the card has an assignedUser", async () => {
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);

      vi.mocked(prisma.cardTransaction.groupBy)
        .mockResolvedValueOnce([
          {
            matchedAppId: "app-1",
            _count: { id: 3 },
            _sum: { useAmt: 150000 },
            _min: { useDt: "20250101" },
            _max: { useDt: "20250301" },
          },
        ] as never)
        .mockResolvedValueOnce([
          { corporateCardId: "card-1", _count: { id: 3 } },
        ] as never);

      vi.mocked(prisma.app.findUnique).mockResolvedValue({
        id: "app-1",
        name: "Slack",
        customLogoUrl: null,
        catalog: { logoUrl: "https://slack.com/logo.png" },
      } as never);

      // Card has an assignedUser and no team
      vi.mocked(prisma.corporateCard.findUnique).mockResolvedValue({
        id: "card-1",
        team: null,
        assignedUser: {
          id: "user-kim",
          name: "Omar Khalid",
          email: "kim@test.com",
          team: { id: "team-dev", name: "Engineering" },
        },
      } as never);

      // SMP-134: load team members (fill availableUsers with the assignedUser's team members)
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: "team-dev",
        name: "Engineering",
        members: [
          { id: "user-kim", name: "Omar Khalid", email: "kim@test.com" },
        ],
      } as never);

      // appendUnassignedUsers: no users with teamId=null
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([]);

      vi.mocked(prisma.cardTransaction.findMany).mockResolvedValue([
        {
          id: "tx-1",
          useDt: "20250101",
          useAmt: 50000,
          teamId: null,
          userId: null,
          linkedSubscriptionId: null,
        },
        {
          id: "tx-2",
          useDt: "20250201",
          useAmt: 50000,
          teamId: null,
          userId: null,
          linkedSubscriptionId: null,
        },
        {
          id: "tx-3",
          useDt: "20250301",
          useAmt: 50000,
          teamId: null,
          userId: null,
          linkedSubscriptionId: null,
        },
      ] as never);

      const result = await suggestFromCardTransactions();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      // assignedUserId must be set
      expect(result.data![0].assignedUserId).toBe("user-kim");
      expect(result.data![0].assignedUserName).toBe("Omar Khalid");
      // When a user is assigned, set teamId/teamName from that user's team
      expect(result.data![0].teamId).toBe("team-dev");
      expect(result.data![0].teamName).toBe("Engineering");
      // SMP-134: availableUsers must be populated
      expect(result.data![0].availableUsers).toHaveLength(1);
    });

    it("sets assignedUserId to null when the card has only a team and no assignedUser", async () => {
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);

      vi.mocked(prisma.cardTransaction.groupBy)
        .mockResolvedValueOnce([
          {
            matchedAppId: "app-1",
            _count: { id: 3 },
            _sum: { useAmt: 150000 },
            _min: { useDt: "20250101" },
            _max: { useDt: "20250301" },
          },
        ] as never)
        .mockResolvedValueOnce([
          { corporateCardId: "card-1", _count: { id: 3 } },
        ] as never);

      vi.mocked(prisma.app.findUnique).mockResolvedValue({
        id: "app-1",
        name: "Slack",
        customLogoUrl: null,
        catalog: null,
      } as never);

      // Card has only a team assigned
      vi.mocked(prisma.corporateCard.findUnique).mockResolvedValue({
        id: "card-1",
        team: {
          id: "team-marketing",
          name: "Marketing",
          members: [
            { id: "user-1", name: "Ahmed Hassan", email: "hong@test.com" },
          ],
        },
        assignedUser: null,
      } as never);

      // appendUnassignedUsers: no users with teamId=null
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([]);

      vi.mocked(prisma.cardTransaction.findMany).mockResolvedValue([
        {
          id: "tx-1",
          useDt: "20250101",
          useAmt: 50000,
          teamId: null,
          userId: null,
          linkedSubscriptionId: null,
        },
        {
          id: "tx-2",
          useDt: "20250201",
          useAmt: 50000,
          teamId: null,
          userId: null,
          linkedSubscriptionId: null,
        },
        {
          id: "tx-3",
          useDt: "20250301",
          useAmt: 50000,
          teamId: null,
          userId: null,
          linkedSubscriptionId: null,
        },
      ] as never);

      const result = await suggestFromCardTransactions();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].assignedUserId).toBeNull();
      expect(result.data![0].assignedUserName).toBeNull();
      expect(result.data![0].teamId).toBe("team-marketing");
    });

    it("sets teamId/assignedUserId to null and includes all organization members in availableUsers when the card has neither team nor assignedUser", async () => {
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);

      vi.mocked(prisma.cardTransaction.groupBy)
        .mockResolvedValueOnce([
          {
            matchedAppId: "app-1",
            _count: { id: 3 },
            _sum: { useAmt: 150000 },
            _min: { useDt: "20250101" },
            _max: { useDt: "20250301" },
          },
        ] as never)
        .mockResolvedValueOnce([
          { corporateCardId: "card-1", _count: { id: 3 } },
        ] as never);

      vi.mocked(prisma.app.findUnique).mockResolvedValue({
        id: "app-1",
        name: "Slack",
        customLogoUrl: null,
        catalog: null,
      } as never);

      // Card has no assignment
      vi.mocked(prisma.corporateCard.findUnique).mockResolvedValue({
        id: "card-1",
        team: null,
        assignedUser: null,
      } as never);

      vi.mocked(prisma.cardTransaction.findMany).mockResolvedValue([
        {
          id: "tx-1",
          useDt: "20250101",
          useAmt: 50000,
          teamId: null,
          userId: null,
          linkedSubscriptionId: null,
        },
        {
          id: "tx-2",
          useDt: "20250201",
          useAmt: 50000,
          teamId: null,
          userId: null,
          linkedSubscriptionId: null,
        },
        {
          id: "tx-3",
          useDt: "20250301",
          useAmt: 50000,
          teamId: null,
          userId: null,
          linkedSubscriptionId: null,
        },
      ] as never);

      // SMP-156: fall back to all organization members
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: "user-1", name: "User 1", email: "user1@test.com" },
        { id: "user-2", name: "User 2", email: "user2@test.com" },
      ] as never);

      const result = await suggestFromCardTransactions();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].assignedUserId).toBeNull();
      expect(result.data![0].teamId).toBeNull();
      // SMP-156: fall back to all organization members when no team/user is assigned
      expect(result.data![0].availableUsers).toHaveLength(2);
    });
  });

  describe("createSubscriptionFromCardSuggestion - automatic assignedUserId assignment", () => {
    const mockOrgId = "org-123";
    const mockUserId = "user-123";

    beforeEach(() => {
      mockedAuth.mockResolvedValue({
        user: {
          id: mockUserId,
          organizationId: mockOrgId,
          role: "ADMIN",
          teamId: null,
        },
        expires: "",
      });
    });

    it("automatically assigns assignedUserId to SubscriptionUser when present", async () => {
      const suggestionWithAssignedUser: CardTransactionSuggestion = {
        appId: "app-1",
        appName: "Slack",
        appLogoUrl: "https://slack.com/logo.png",
        suggestedBillingCycle: "MONTHLY",
        suggestedAmount: 50000,
        currency: "KRW",
        paymentCount: 3,
        firstPaymentDate: new Date("2025-01-01"),
        lastPaymentDate: new Date("2025-03-01"),
        confidence: 0.85,
        teamId: "team-dev",
        teamName: "Engineering",
        assignedUserId: "user-kim",
        assignedUserName: "Omar Khalid",
        availableUsers: [],
        source: "card_transaction",
        suggestedAction: "create",
        unmatchedTransactionIds: ["tx-1", "tx-2"],
        billingType: "PER_SEAT",
        perSeatPrice: null,
        suggestedSeats: null,
      };

      vi.mocked(prisma.app.findFirst).mockResolvedValue({
        id: "app-1",
        name: "Slack",
      } as never);
      vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null);
      // SMP-123: added mock for ensureAppTeamAssignment
      vi.mocked(prisma.appTeam.findFirst).mockResolvedValue({
        id: "app-team-1",
        appId: "app-1",
        teamId: "team-dev",
      } as never);
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: "user-kim" },
      ] as never);
      vi.mocked(prisma.subscription.create).mockResolvedValue({
        id: "sub-1",
      } as never);
      vi.mocked(prisma.subscriptionUser.createMany).mockResolvedValue({
        count: 1,
      } as never);
      // SMP-123: added cardTransaction.updateMany mock
      vi.mocked(prisma.cardTransaction.updateMany).mockResolvedValue({
        count: 2,
      } as never);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      // Auto-assign when assignedUserId is set even if selectedUserIds is empty
      const result = await createSubscriptionFromCardSuggestion({
        suggestion: suggestionWithAssignedUser,
        selectedUserIds: [],
      });

      expect(result.success).toBe(true);
      // subscription.teamId is set to the user's team
      expect(prisma.subscription.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          teamId: "team-dev",
        }),
      });
      // assignedUserId is auto-assigned to SubscriptionUser
      expect(prisma.subscriptionUser.createMany).toHaveBeenCalledWith({
        data: [
          {
            subscriptionId: "sub-1",
            userId: "user-kim",
            assignedBy: mockUserId,
          },
        ],
        skipDuplicates: true, // SMP-123: skipDuplicates added
      });
    });

    it("handles both selectedUserIds and assignedUserId", async () => {
      const suggestionWithBoth: CardTransactionSuggestion = {
        appId: "app-1",
        appName: "Slack",
        appLogoUrl: null,
        suggestedBillingCycle: "MONTHLY",
        suggestedAmount: 50000,
        currency: "KRW",
        paymentCount: 3,
        firstPaymentDate: new Date("2025-01-01"),
        lastPaymentDate: new Date("2025-03-01"),
        confidence: 0.85,
        teamId: "team-dev",
        teamName: "Engineering",
        assignedUserId: "user-kim",
        assignedUserName: "Omar Khalid",
        availableUsers: [
          {
            id: "user-lee",
            name: "Sara Ali",
            email: "lee@test.com",
            teamId: "team-dev",
            teamName: "Engineering",
          },
        ],
        source: "card_transaction",
        suggestedAction: "create",
        unmatchedTransactionIds: ["tx-1"],
        billingType: "PER_SEAT",
        perSeatPrice: null,
        suggestedSeats: null,
      };

      vi.mocked(prisma.app.findFirst).mockResolvedValue({
        id: "app-1",
        name: "Slack",
      } as never);
      vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null);
      // SMP-123: added mock for ensureAppTeamAssignment
      vi.mocked(prisma.appTeam.findFirst).mockResolvedValue({
        id: "app-team-1",
        appId: "app-1",
        teamId: "team-dev",
      } as never);
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: "user-kim" },
        { id: "user-lee" },
      ] as never);
      vi.mocked(prisma.subscription.create).mockResolvedValue({
        id: "sub-1",
      } as never);
      vi.mocked(prisma.subscriptionUser.createMany).mockResolvedValue({
        count: 2,
      } as never);
      // SMP-123: added cardTransaction.updateMany mock
      vi.mocked(prisma.cardTransaction.updateMany).mockResolvedValue({
        count: 1,
      } as never);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

      const result = await createSubscriptionFromCardSuggestion({
        suggestion: suggestionWithBoth,
        selectedUserIds: ["user-lee"],
      });

      expect(result.success).toBe(true);
      // assignedUserId + selectedUserIds are all assigned (deduplicated)
      expect(prisma.subscriptionUser.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ userId: "user-kim" }),
          expect.objectContaining({ userId: "user-lee" }),
        ]),
        skipDuplicates: true, // SMP-123: skipDuplicates added
      });
    });
  });

  describe("suggestSubscriptionsFromPayments - error handling", () => {
    it("returns { success: false } when requireOrganization throws a generic error", async () => {
      mockedAuth.mockRejectedValue(new Error("Auth service unavailable"));

      const result = await suggestSubscriptionsFromPayments();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Auth service unavailable");
    });

    it("returns { success: false } when a Prisma query fails", async () => {
      mockedAuth.mockResolvedValue({
        user: {
          id: "user-123",
          organizationId: "org-123",
          role: "ADMIN",
          teamId: null,
        },
        expires: "",
      });
      vi.mocked(prisma.subscription.findMany).mockRejectedValue(
        new Error("DB connection failed")
      );

      const result = await suggestSubscriptionsFromPayments();

      expect(result.success).toBe(false);
      expect(result.error).toBe("DB connection failed");
    });

    it("rethrows redirect errors as-is", async () => {
      mockedAuth.mockImplementation(() => {
        const error = new Error("NEXT_REDIRECT:/login");
        (error as Error & { digest: string }).digest = "NEXT_REDIRECT:/login";
        throw error;
      });

      await expect(suggestSubscriptionsFromPayments()).rejects.toThrow(
        "NEXT_REDIRECT:/login"
      );
    });
  });
});
