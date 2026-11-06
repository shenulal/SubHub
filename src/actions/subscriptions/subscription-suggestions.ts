"use server";

import { requireOrganization } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import { getBaseCurrency } from "@/lib/fx/base-currency";
import { withLogging } from "@/lib/logging";
import { can } from "@/lib/rbac/service";
import { detectBillingType } from "@/lib/services/subscription/seat-detector";
import { calculateNextRenewalDate } from "@/lib/utils/renewal-date";
import type { ActionState } from "@/types";
import type { BillingType } from "@prisma/client";
import { BillingCycle } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { isRedirectError } from "./subscription-crud.types";

const NO_CREATE_PERMISSION = "You do not have permission to add subscriptions";
const NO_ASSIGN_PERMISSION =
  "You do not have permission to assign users to subscriptions";

// ==================== SMP-107: App-Team assignment helper ====================

/** Load the organization's default active tax rate (percent) for seat-price tax removal. */
async function getDefaultTaxRatePercent(
  organizationId: string
): Promise<number | undefined> {
  const rate = await prisma.taxRate.findFirst({
    where: { organizationId, isDefault: true, isActive: true },
    select: { ratePercent: true },
  });
  return rate ? Number(rate.ratePercent) : undefined;
}

/**
 * SMP-107: Ensure the app is assigned to the given team; assign it automatically if not
 */
export async function ensureAppTeamAssignment(
  appId: string,
  teamId: string | null
): Promise<ActionState<{ created: boolean; appTeamId?: string }>> {
  // Do nothing when teamId is null
  if (!teamId) {
    return { success: true, data: { created: false } };
  }

  const { organizationId, userId } = await requireOrganization();

  // Check for an existing AppTeam
  const existingAppTeam = await prisma.appTeam.findFirst({
    where: { appId, teamId },
  });

  if (existingAppTeam) {
    return {
      success: true,
      data: { created: false, appTeamId: existingAppTeam.id },
    };
  }

  // Create the AppTeam
  const appTeam = await prisma.appTeam.create({
    data: {
      appId,
      teamId,
      assignedBy: userId,
    },
  });

  // Write the audit log
  await prisma.auditLog.create({
    data: {
      action: "ASSIGN_APP_TEAM",
      entityType: "AppTeam",
      entityId: appTeam.id,
      userId,
      organizationId,
      metadata: {
        appId,
        teamId,
        source: "payment_suggestion_auto",
      },
    },
  });

  return { success: true, data: { created: true, appTeamId: appTeam.id } };
}

// ==================== Subscription suggestions (from payment records) ====================

export interface SubscriptionSuggestion {
  appId: string;
  appName: string;
  appLogoUrl: string | null;
  suggestedBillingCycle: BillingCycle;
  suggestedAmount: number;
  currency: string;
  paymentCount: number;
  firstPaymentDate: Date;
  lastPaymentDate: Date;
  confidence: number; // 0-1
  // SMP-134: fields for seat-based subscription detection
  billingType: BillingType;
  perSeatPrice: number | null;
  suggestedSeats: number | null;
  // SMP-160: seat detection metadata
  seatDetectionMethod?: string;
  seatDetectionConfidence?: number;
}

/**
 * SMP-107: subscription suggestion action type
 * - create: a new subscription is needed
 * - link: only link payment records to an existing subscription
 * - update: the existing subscription needs updating
 */
export type SuggestedAction = "create" | "link" | "update";

/**
 * SMP-78/SMP-107: PaymentRecord-based subscription suggestion type (includes team/user assignment)
 */
export interface PaymentRecordSuggestion extends SubscriptionSuggestion {
  teamId: string | null;
  teamName: string | null;
  assignedUserId: string | null;
  assignedUserName: string | null;
  availableUsers: {
    id: string;
    name: string | null;
    email: string;
    teamId: string | null;
    teamName: string | null;
  }[];
  source: "payment_record";
  // SMP-107: additional fields
  existingSubscriptionId?: string; // existing subscription ID (for link actions)
  suggestedAction: SuggestedAction; // suggested action
  unmatchedPaymentIds: string[]; // IDs of unlinked payment records
}

/**
 * Build subscription suggestions from payment records
 * - Detects recurring patterns in payment records matched to the same app
 * - SMP-107: includes apps that already have a subscription if they have unlinked payment records
 * - SMP-78: includes team/user assignment
 */
export async function suggestSubscriptionsFromPayments(): Promise<
  ActionState<PaymentRecordSuggestion[]>
> {
  try {
    const { organizationId } = await requireOrganization();
    const taxRatePercent = await getDefaultTaxRatePercent(organizationId);

    // 1. SMP-107: load app IDs that already have subscriptions, with subscription details (ID map)
    const existingSubscriptions = await prisma.subscription.findMany({
      where: { organizationId },
      select: { id: true, appId: true },
    });
    const appToSubscriptionMap = new Map(
      existingSubscriptions.map((s) => [s.appId, s.id])
    );

    // 2. Aggregate payment records per app (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const paymentsByApp = await prisma.paymentRecord.groupBy({
      by: ["matchedAppId"],
      where: {
        organizationId,
        matchedAppId: { not: null },
        matchStatus: { in: ["AUTO_MATCHED", "MANUAL"] },
        transactionDate: { gte: twelveMonthsAgo },
      },
      _count: { id: true },
      _sum: { amount: true },
      _min: { transactionDate: true },
      _max: { transactionDate: true },
    });

    // 3. Load each app's payment records and analyse the pattern
    const suggestions: PaymentRecordSuggestion[] = [];

    for (const group of paymentsByApp) {
      if (!group.matchedAppId) {
        continue;
      }

      // At least 2 payments are needed for pattern analysis
      if (group._count.id < 2) {
        continue;
      }

      // Load app details (SMP-160: includes pricingModel, basePricePerSeat)
      const app = await prisma.app.findUnique({
        where: { id: group.matchedAppId },
        include: {
          catalog: {
            select: {
              logoUrl: true,
              pricingModel: true,
              basePricePerSeat: true,
            },
          },
        },
      });

      if (!app) continue;

      // SMP-107: load payment record details (includes linkedSubscriptionId)
      const payments = await prisma.paymentRecord.findMany({
        where: {
          organizationId,
          matchedAppId: group.matchedAppId,
          matchStatus: { in: ["AUTO_MATCHED", "MANUAL"] },
          transactionDate: { gte: twelveMonthsAgo },
        },
        orderBy: { transactionDate: "asc" },
        select: {
          id: true, // SMP-107: ID required
          transactionDate: true,
          amount: true,
          currency: true,
          teamId: true,
          userId: true,
          linkedSubscriptionId: true, // SMP-107: check link status
        },
      });

      // SMP-107: filter unlinked payment records
      const unmatchedPayments = payments.filter(
        (p) => p.linkedSubscriptionId === null
      );
      const unmatchedPaymentIds = unmatchedPayments.map((p) => p.id);

      // SMP-107: check for an existing subscription
      const existingSubscriptionId = appToSubscriptionMap.get(
        group.matchedAppId
      );
      const hasExistingSubscription = !!existingSubscriptionId;

      // SMP-107: skip if a subscription exists and all payment records are linked
      if (hasExistingSubscription && unmatchedPaymentIds.length === 0) {
        continue;
      }

      // SMP-107: without a subscription at least 2 records are needed; with one, any unlinked record is enough
      if (!hasExistingSubscription && payments.length < 2) {
        continue;
      }

      // Analyse the billing cycle
      const { billingCycle, confidence } = analyzeBillingCycle(payments);

      // Calculate the average amount
      const avgAmount =
        payments.reduce((sum, p) => sum + Number(p.amount), 0) /
        payments.length;

      // SMP-134/SMP-160: auto-detect seat-based subscriptions (includes catalogue data)
      const paymentAmounts = payments.map((p) => Number(p.amount));
      const seatDetection = detectBillingType({
        appName: app.name,
        amounts: paymentAmounts,
        catalogPricingModel: app.catalog?.pricingModel ?? null,
        catalogBasePricePerSeat: app.catalog?.basePricePerSeat
          ? Number(app.catalog.basePricePerSeat)
          : null,
        taxRatePercent,
      });

      // SMP-78: dominant team/user analysis (the most frequently assigned team or user)
      let teamId: string | null = null;
      let teamName: string | null = null;
      let assignedUserId: string | null = null;
      let assignedUserName: string | null = null;
      let availableUsers: AvailableUserWithTeam[] = [];

      // Compute the dominant team/user from assigned payment records
      const teamCounts = new Map<string, number>();
      const userCounts = new Map<string, number>();

      for (const payment of payments) {
        if (payment.teamId) {
          teamCounts.set(
            payment.teamId,
            (teamCounts.get(payment.teamId) || 0) + 1
          );
        }
        if (payment.userId) {
          userCounts.set(
            payment.userId,
            (userCounts.get(payment.userId) || 0) + 1
          );
        }
      }

      // Determine the dominant team
      let maxTeamCount = 0;
      let dominantTeamId: string | null = null;
      for (const [tid, count] of teamCounts) {
        if (count > maxTeamCount) {
          maxTeamCount = count;
          dominantTeamId = tid;
        }
      }

      // Determine the dominant user
      let maxUserCount = 0;
      let dominantUserId: string | null = null;
      for (const [uid, count] of userCounts) {
        if (count > maxUserCount) {
          maxUserCount = count;
          dominantUserId = uid;
        }
      }

      // User assignment takes precedence over team assignment (more specific)
      if (dominantUserId) {
        const user = await prisma.user.findUnique({
          where: { id: dominantUserId },
          select: {
            id: true,
            name: true,
            email: true,
            team: { select: { id: true, name: true } },
          },
        });
        if (user) {
          assignedUserId = user.id;
          assignedUserName = user.name || user.email;
          if (user.team) {
            teamId = user.team.id;
            teamName = user.team.name;
            // SMP-134: fill availableUsers with the user's team members
            const teamWithMembers = await prisma.team.findUnique({
              where: { id: user.team.id },
              include: {
                members: {
                  where: { status: "ACTIVE" },
                  select: { id: true, name: true, email: true },
                },
              },
            });
            if (teamWithMembers) {
              availableUsers = mapMembersToAvailableUsers(
                teamWithMembers.members,
                user.team!.id,
                user.team!.name
              );
              availableUsers = await appendUnassignedUsers(
                availableUsers,
                organizationId
              );
            }
          } else {
            // SMP-134: fall back to all organization members when there is no team
            const allUsers = await prisma.user.findMany({
              where: { organizationId, status: "ACTIVE" },
              select: {
                id: true,
                name: true,
                email: true,
                teamId: true,
                team: { select: { name: true } },
              },
            });
            availableUsers = mapUsersWithOwnTeam(allUsers);
          }
        }
      } else if (dominantTeamId) {
        const team = await prisma.team.findUnique({
          where: { id: dominantTeamId },
          include: {
            members: {
              where: { status: "ACTIVE" },
              select: { id: true, name: true, email: true },
            },
          },
        });
        if (team) {
          teamId = team.id;
          teamName = team.name;
          availableUsers = mapMembersToAvailableUsers(
            team.members,
            team.id,
            team.name
          );
          availableUsers = await appendUnassignedUsers(
            availableUsers,
            organizationId
          );
        }
      } else {
        // SMP-156: fall back to all active organization members when there is no team/user assignment
        const allUsers = await prisma.user.findMany({
          where: { organizationId, status: "ACTIVE" },
          select: {
            id: true,
            name: true,
            email: true,
            teamId: true,
            team: { select: { name: true } },
          },
        });
        availableUsers = mapUsersWithOwnTeam(allUsers);
      }

      // SMP-134: ensure assignedUserId is always included in availableUsers
      if (
        assignedUserId &&
        !availableUsers.some((u) => u.id === assignedUserId)
      ) {
        const assignedUser = await prisma.user.findUnique({
          where: { id: assignedUserId },
          select: {
            id: true,
            name: true,
            email: true,
            teamId: true,
            team: { select: { name: true } },
          },
        });
        if (assignedUser) {
          availableUsers = [
            {
              id: assignedUser.id,
              name: assignedUser.name,
              email: assignedUser.email,
              teamId: assignedUser.teamId ?? null,
              teamName: assignedUser.team?.name ?? null,
            },
            ...availableUsers,
          ];
        }
      }

      // Only suggest when confidence is 0.5 or higher
      if (confidence >= 0.5) {
        // SMP-107: determine suggestedAction
        const suggestedAction: SuggestedAction = existingSubscriptionId
          ? "link"
          : "create";

        suggestions.push({
          appId: app.id,
          appName: app.name,
          appLogoUrl: app.customLogoUrl || app.catalog?.logoUrl || null,
          suggestedBillingCycle: billingCycle,
          suggestedAmount: Math.round(avgAmount),
          currency:
            payments[0]?.currency || (await getBaseCurrency(organizationId)),
          paymentCount: payments.length,
          firstPaymentDate: group._min.transactionDate!,
          lastPaymentDate: group._max.transactionDate!,
          confidence,
          // SMP-134/SMP-160: seat-based subscription detection
          billingType: seatDetection.billingType,
          perSeatPrice: seatDetection.perSeatPrice,
          suggestedSeats: seatDetection.suggestedSeats,
          seatDetectionMethod: seatDetection.method,
          seatDetectionConfidence: seatDetection.confidence,
          // SMP-78: team/user assignment
          teamId,
          teamName,
          assignedUserId,
          assignedUserName,
          availableUsers,
          source: "payment_record",
          // SMP-107: additional fields
          existingSubscriptionId,
          suggestedAction,
          unmatchedPaymentIds,
        });
      }
    }

    // Sort by confidence, highest first
    suggestions.sort((a, b) => b.confidence - a.confidence);

    return { success: true, data: suggestions };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "An error occurred while analysing subscription suggestions",
    };
  }
}

// ==================== availableUser mapping helpers ====================

type AvailableUserWithTeam = {
  id: string;
  name: string | null;
  email: string;
  teamId: string | null;
  teamName: string | null;
};

/**
 * Convert team members to an AvailableUserWithTeam array (team info set explicitly)
 */
function mapMembersToAvailableUsers(
  members: { id: string; name: string | null; email: string }[],
  teamId: string,
  teamName: string
): AvailableUserWithTeam[] {
  return members.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    teamId,
    teamName,
  }));
}

/**
 * Convert all organization users to an AvailableUserWithTeam array (uses each user's own team)
 */
function mapUsersWithOwnTeam(
  users: {
    id: string;
    name: string | null;
    email: string;
    teamId: string | null;
    team: { name: string } | null;
  }[]
): AvailableUserWithTeam[] {
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    teamId: u.teamId ?? null,
    teamName: u.team?.name ?? null,
  }));
}

/**
 * Append unassigned (teamId=null) users to availableUsers
 * Users already included are not added again
 */
async function appendUnassignedUsers(
  availableUsers: AvailableUserWithTeam[],
  organizationId: string
): Promise<AvailableUserWithTeam[]> {
  const unassignedUsers = await prisma.user.findMany({
    where: { organizationId, status: "ACTIVE", teamId: null },
    select: {
      id: true,
      name: true,
      email: true,
      teamId: true,
      team: { select: { name: true } },
    },
  });
  const unassignedMapped = mapUsersWithOwnTeam(unassignedUsers);
  const existingIds = new Set(availableUsers.map((u) => u.id));
  return [
    ...availableUsers,
    ...unassignedMapped.filter((u) => !existingIds.has(u.id)),
  ];
}

/**
 * Billing cycle analysis helper
 */
function analyzeBillingCycle(
  payments: { transactionDate: Date; amount: unknown }[]
): {
  billingCycle: BillingCycle;
  confidence: number;
} {
  if (payments.length < 2) {
    return { billingCycle: "MONTHLY", confidence: 0 };
  }

  // Payment intervals (in days)
  const intervals: number[] = [];
  for (let i = 1; i < payments.length; i++) {
    const days = Math.round(
      (new Date(payments[i].transactionDate).getTime() -
        new Date(payments[i - 1].transactionDate).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    intervals.push(days);
  }

  // Average interval
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

  // Interval standard deviation (measures consistency)
  const variance =
    intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) /
    intervals.length;
  const stdDev = Math.sqrt(variance);

  // Determine the billing cycle
  let billingCycle: BillingCycle;
  let expectedInterval: number;

  if (avgInterval <= 45) {
    billingCycle = "MONTHLY";
    expectedInterval = 30;
  } else if (avgInterval <= 120) {
    billingCycle = "QUARTERLY";
    expectedInterval = 90;
  } else if (avgInterval <= 400) {
    billingCycle = "YEARLY";
    expectedInterval = 365;
  } else {
    billingCycle = "ONE_TIME";
    expectedInterval = avgInterval;
  }

  // Confidence: higher with a smaller standard deviation and more payments
  const intervalAccuracy = Math.max(
    0,
    1 - Math.abs(avgInterval - expectedInterval) / expectedInterval
  );
  const consistencyScore = Math.max(0, 1 - stdDev / avgInterval);
  const countBonus = Math.min(1, payments.length / 6);

  const confidence =
    intervalAccuracy * 0.4 + consistencyScore * 0.4 + countBonus * 0.2;

  return { billingCycle, confidence: Math.round(confidence * 100) / 100 };
}

/**
 * Create a subscription from a suggestion
 */
async function _createSubscriptionFromSuggestion(
  suggestion: SubscriptionSuggestion
): Promise<ActionState<{ id: string }>> {
  const { organizationId, userId } = await requireOrganization();
  if (!(await can("subscriptions:create"))) {
    return { success: false, message: NO_CREATE_PERMISSION };
  }

  const app = await prisma.app.findFirst({
    where: { id: suggestion.appId, organizationId },
  });

  if (!app) {
    return { success: false, message: "App not found" };
  }

  const existingSubscription = await prisma.subscription.findFirst({
    where: { appId: suggestion.appId, organizationId },
  });

  if (existingSubscription) {
    return {
      success: false,
      message: "A subscription for this app already exists",
    };
  }

  const renewalDate = calculateNextRenewalDate(
    suggestion.lastPaymentDate,
    suggestion.suggestedBillingCycle
  );

  const subscription = await prisma.subscription.create({
    data: {
      appId: suggestion.appId,
      organizationId,
      status: "ACTIVE",
      billingCycle: suggestion.suggestedBillingCycle,
      billingType: suggestion.billingType, // SMP-134
      amount: suggestion.suggestedAmount,
      perSeatPrice: suggestion.perSeatPrice, // SMP-134
      currency: suggestion.currency,
      totalLicenses: null, // SMP-160: no longer auto-filled from suggestedSeats (user input only)
      startDate: suggestion.firstPaymentDate,
      renewalDate,
      autoRenewal: true,
      renewalAlert30: true,
      notes: `Auto-created from payment records (${suggestion.paymentCount} payments analysed, ${Math.round(suggestion.confidence * 100)}% confidence)`,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "CREATE_SUBSCRIPTION",
      entityType: "Subscription",
      entityId: subscription.id,
      userId,
      organizationId,
      metadata: {
        appName: app.name,
        source: "payment_suggestion",
        confidence: suggestion.confidence,
      },
    },
  });

  revalidatePath("/subscriptions");

  return { success: true, data: { id: subscription.id } };
}
export const createSubscriptionFromSuggestion = withLogging(
  "createSubscriptionFromSuggestion",
  _createSubscriptionFromSuggestion
);

/**
 * SMP-78: input type for creating a subscription from a PaymentRecord suggestion
 */
export interface CreateSubscriptionFromPaymentSuggestionInput {
  suggestion: PaymentRecordSuggestion;
  selectedUserIds: string[];
  billingType?: string; // SMP-134: reflects the user's checkbox state
  totalLicenses?: number | null; // SMP-134: total seats entered by the user
}

/**
 * SMP-78/SMP-107: create or link a subscription from a PaymentRecord suggestion
 * - suggestedAction: create → create a new subscription
 * - suggestedAction: link → only link payment records to the existing subscription
 * - Auto-assigns App-Team and attaches SubscriptionUser records
 */
async function _createSubscriptionFromPaymentSuggestion(
  input: CreateSubscriptionFromPaymentSuggestionInput
): Promise<ActionState<{ id: string }>> {
  const {
    suggestion,
    selectedUserIds,
    billingType: overrideBillingType,
    totalLicenses: overrideTotalLicenses,
  } = input;
  const { organizationId, userId } = await requireOrganization();

  if (!(await can("subscriptions:create"))) {
    return { success: false, message: NO_CREATE_PERMISSION };
  }
  // Assigning seats to other members needs subscriptions:assign
  if (selectedUserIds.length > 0 && !(await can("subscriptions:assign"))) {
    return { success: false, message: NO_ASSIGN_PERMISSION };
  }

  const app = await prisma.app.findFirst({
    where: { id: suggestion.appId, organizationId },
  });

  if (!app) {
    return { success: false, message: "App not found" };
  }

  // SMP-107: check for an existing subscription
  const existingSubscription = await prisma.subscription.findFirst({
    where: { appId: suggestion.appId, organizationId },
  });

  // SMP-107: suggestedAction link - only link payment records to the existing subscription
  if (suggestion.suggestedAction === "link" && existingSubscription) {
    // Link payment records
    if (suggestion.unmatchedPaymentIds.length > 0) {
      await prisma.paymentRecord.updateMany({
        where: { id: { in: suggestion.unmatchedPaymentIds } },
        data: { linkedSubscriptionId: existingSubscription.id },
      });
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: "LINK_PAYMENT_RECORDS",
        entityType: "Subscription",
        entityId: existingSubscription.id,
        userId,
        organizationId,
        metadata: {
          appName: app.name,
          linkedPaymentCount: suggestion.unmatchedPaymentIds.length,
        },
      },
    });

    revalidatePath("/subscriptions");
    revalidatePath("/payments");

    return { success: true, data: { id: existingSubscription.id } };
  }

  // suggestedAction create - create a new subscription
  if (existingSubscription) {
    return {
      success: false,
      message: "A subscription for this app already exists",
    };
  }

  // SMP-107: auto-assign App-Team
  await ensureAppTeamAssignment(suggestion.appId, suggestion.teamId);

  // Add assignedUserId to the users to assign, when present
  const userIdsToAssign = new Set(selectedUserIds);
  if (suggestion.assignedUserId) {
    userIdsToAssign.add(suggestion.assignedUserId);
  }
  const finalUserIds = Array.from(userIdsToAssign);
  let userTeamIds: string[] = [];

  // Validate selected users (must belong to the organization)
  if (finalUserIds.length > 0) {
    const validUsers = await prisma.user.findMany({
      where: {
        id: { in: finalUserIds },
        organizationId,
      },
      select: { id: true, teamId: true },
    });

    if (validUsers.length !== finalUserIds.length) {
      return {
        success: false,
        message: "One or more users are invalid",
      };
    }

    // SMP-134: auto-link team and app when assigning users
    userTeamIds = validUsers
      .filter((u) => u.teamId != null)
      .map((u) => u.teamId as string);
    if (userTeamIds.length > 0) {
      const existingAppTeams = await prisma.appTeam.findMany({
        where: { appId: suggestion.appId, teamId: { in: userTeamIds } },
        select: { teamId: true },
      });
      const existingTeamIds = new Set(existingAppTeams.map((at) => at.teamId));
      const missingTeamIds = [
        ...new Set(userTeamIds.filter((id) => !existingTeamIds.has(id))),
      ];
      if (missingTeamIds.length > 0) {
        await prisma.appTeam.createMany({
          data: missingTeamIds.map((teamId) => ({
            appId: suggestion.appId,
            teamId,
            assignedBy: userId,
          })),
          skipDuplicates: true,
        });
      }
    }
  }

  // SMP-134: billingType/totalLicenses overrides
  const finalBillingType =
    (overrideBillingType as "FLAT_RATE" | "PER_SEAT") || suggestion.billingType;
  // SMP-160: no auto-fill from suggestedSeats — use override values only
  const finalTotalLicenses =
    overrideTotalLicenses !== undefined ? overrideTotalLicenses : null;

  const renewalDate = calculateNextRenewalDate(
    suggestion.lastPaymentDate,
    suggestion.suggestedBillingCycle
  );

  const subscription = await prisma.subscription.create({
    data: {
      appId: suggestion.appId,
      organizationId,
      teamId: suggestion.teamId,
      status: "ACTIVE",
      billingCycle: suggestion.suggestedBillingCycle,
      billingType: finalBillingType,
      amount: suggestion.suggestedAmount,
      perSeatPrice: suggestion.perSeatPrice,
      currency: suggestion.currency,
      totalLicenses: finalTotalLicenses,
      usedLicenses: finalUserIds.length > 0 ? finalUserIds.length : null,
      startDate: suggestion.firstPaymentDate,
      renewalDate,
      autoRenewal: true,
      renewalAlert30: true,
      notes: `Auto-created from payment records (CSV) (${suggestion.paymentCount} payments analysed, ${Math.round(suggestion.confidence * 100)}% confidence)`,
    },
  });

  // Create SubscriptionTeam (when suggestion.teamId is set)
  if (suggestion.teamId) {
    await prisma.subscriptionTeam.create({
      data: {
        subscriptionId: subscription.id,
        teamId: suggestion.teamId,
        assignedBy: userId,
      },
    });
  }

  // SMP-107: link PaymentRecord.linkedSubscriptionId
  if (suggestion.unmatchedPaymentIds.length > 0) {
    await prisma.paymentRecord.updateMany({
      where: { id: { in: suggestion.unmatchedPaymentIds } },
      data: { linkedSubscriptionId: subscription.id },
    });
  }

  // SMP-107: create SubscriptionUser records
  if (finalUserIds.length > 0) {
    await prisma.subscriptionUser.createMany({
      data: finalUserIds.map((uid) => ({
        subscriptionId: subscription.id,
        userId: uid,
        assignedBy: userId,
      })),
      skipDuplicates: true,
    });

    // SMP-180: user's team → auto-link SubscriptionTeam (when suggestion.teamId is absent)
    if (!suggestion.teamId && userTeamIds.length > 0) {
      const uniqueUserTeamIds = [...new Set(userTeamIds)];
      await prisma.subscriptionTeam.createMany({
        data: uniqueUserTeamIds.map((tid) => ({
          subscriptionId: subscription.id,
          teamId: tid,
          assignedBy: userId,
        })),
        skipDuplicates: true,
      });

      // Dual-write: update subscription.teamId (first team)
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { teamId: uniqueUserTeamIds[0] },
      });
    }
  }

  // SMP-160: include the seat detection result in the audit log
  const seatDetectionLog = {
    billingType: suggestion.billingType,
    perSeatPrice: suggestion.perSeatPrice,
    suggestedSeats: suggestion.suggestedSeats,
    method: suggestion.seatDetectionMethod ?? null,
    confidence: suggestion.seatDetectionConfidence ?? null,
    overridden: overrideBillingType
      ? overrideBillingType !== suggestion.billingType
      : false,
    overriddenTo: overrideBillingType ?? null,
  };

  await prisma.auditLog.create({
    data: {
      action: "CREATE_SUBSCRIPTION",
      entityType: "Subscription",
      entityId: subscription.id,
      userId,
      organizationId,
      metadata: {
        appName: app.name,
        source: "payment_record_suggestion",
        confidence: suggestion.confidence,
        teamId: suggestion.teamId,
        assignedUserId: suggestion.assignedUserId,
        assignedUserCount: finalUserIds.length,
        linkedPaymentCount: suggestion.unmatchedPaymentIds.length,
        seatDetection: seatDetectionLog,
      },
    },
  });

  revalidatePath("/subscriptions");
  revalidatePath("/payments");

  return { success: true, data: { id: subscription.id } };
}
export const createSubscriptionFromPaymentSuggestion = withLogging(
  "createSubscriptionFromPaymentSuggestion",
  _createSubscriptionFromPaymentSuggestion
);

// ==================== Subscription suggestion count (for dashboard alerts) ====================

/**
 * Get the subscription suggestion count for dashboard alerts
 * - Returns the number of candidate apps with unregistered/unlinked subscriptions from PaymentRecord and CardTransaction
 * - Skips confidence calculation (lightweight query)
 */
export async function getSuggestionCount(): Promise<
  ActionState<{ count: number }>
> {
  try {
    const { organizationId } = await requireOrganization();

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const twelveMonthsAgoStr = twelveMonthsAgo
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");

    // Load app IDs with existing subscriptions
    const existingSubscriptions = await prisma.subscription.findMany({
      where: { organizationId },
      select: { appId: true },
    });
    const existingAppIds = new Set(existingSubscriptions.map((s) => s.appId));

    // PaymentRecord groups: all + unlinked
    const [paymentTotalGroups, paymentUnlinkedGroups] = await Promise.all([
      prisma.paymentRecord.groupBy({
        by: ["matchedAppId"],
        where: {
          organizationId,
          matchedAppId: { not: null },
          matchStatus: { in: ["AUTO_MATCHED", "MANUAL"] },
          transactionDate: { gte: twelveMonthsAgo },
        },
        _count: { id: true },
      }),
      prisma.paymentRecord.groupBy({
        by: ["matchedAppId"],
        where: {
          organizationId,
          matchedAppId: { not: null },
          matchStatus: { in: ["AUTO_MATCHED", "MANUAL"] },
          linkedSubscriptionId: null,
          transactionDate: { gte: twelveMonthsAgo },
        },
        _count: { id: true },
      }),
    ]);

    // CardTransaction groups: all + unlinked
    const [cardTotalGroups, cardUnlinkedGroups] = await Promise.all([
      prisma.cardTransaction.groupBy({
        by: ["matchedAppId"],
        where: {
          organizationId,
          matchedAppId: { not: null },
          matchStatus: { in: ["AUTO_MATCHED", "MANUAL"] },
          useDt: { gte: twelveMonthsAgoStr },
        },
        _count: { id: true },
      }),
      prisma.cardTransaction.groupBy({
        by: ["matchedAppId"],
        where: {
          organizationId,
          matchedAppId: { not: null },
          matchStatus: { in: ["AUTO_MATCHED", "MANUAL"] },
          linkedSubscriptionId: null,
          useDt: { gte: twelveMonthsAgoStr },
        },
        _count: { id: true },
      }),
    ]);

    const unlinkedPaymentMap = new Map(
      paymentUnlinkedGroups.map((g) => [g.matchedAppId, g._count.id])
    );
    const unlinkedCardMap = new Map(
      cardUnlinkedGroups.map((g) => [g.matchedAppId, g._count.id])
    );

    const pendingAppIds = new Set<string>();

    // Collect PaymentRecord-based candidate apps
    for (const g of paymentTotalGroups) {
      if (!g.matchedAppId) continue;
      const unlinkedCount = unlinkedPaymentMap.get(g.matchedAppId) ?? 0;
      const hasExistingSub = existingAppIds.has(g.matchedAppId);

      if (hasExistingSub && unlinkedCount > 0) {
        pendingAppIds.add(g.matchedAppId);
      } else if (!hasExistingSub && g._count.id >= 2) {
        pendingAppIds.add(g.matchedAppId);
      }
    }

    // Collect CardTransaction-based candidate apps (deduplicated against PaymentRecord)
    for (const g of cardTotalGroups) {
      if (!g.matchedAppId) continue;
      const unlinkedCount = unlinkedCardMap.get(g.matchedAppId) ?? 0;
      const hasExistingSub = existingAppIds.has(g.matchedAppId);

      if (hasExistingSub && unlinkedCount > 0) {
        pendingAppIds.add(g.matchedAppId);
      } else if (!hasExistingSub && g._count.id >= 2) {
        pendingAppIds.add(g.matchedAppId);
      }
    }

    return { success: true, data: { count: pendingAppIds.size } };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return {
      success: false,
      error: "An error occurred while counting subscription suggestions",
    };
  }
}

// ==================== Subscription suggestions from corporate card transactions (Phase 3) ====================

/**
 * Convert a YYYYMMDD string to a Date
 * CardTransaction.useDt is in "20250109" format, so passing it directly to new Date() yields Invalid Date
 */
function parseYYYYMMDD(dateStr: string): Date {
  return new Date(
    `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
  );
}

/**
 * CardTransaction-based subscription suggestion type
 * - Team auto-assignment: based on CorporateCard.teamId or assignedUser.teamId
 * - User auto-assignment: assigned automatically when CorporateCard.assignedUserId is set
 * - User selection: provides the Team.members list
 * - SMP-123: extended to the same structure as PaymentRecord
 */
export interface CardTransactionSuggestion extends SubscriptionSuggestion {
  teamId: string | null;
  teamName: string | null;
  // Phase 2: user assigned to the card
  assignedUserId: string | null;
  assignedUserName: string | null;
  availableUsers: {
    id: string;
    name: string | null;
    email: string;
    teamId: string | null;
    teamName: string | null;
  }[];
  source: "card_transaction";
  // SMP-123: same fields as PaymentRecord
  existingSubscriptionId?: string;
  suggestedAction: SuggestedAction;
  unmatchedTransactionIds: string[];
}

/**
 * Input type for creating a subscription from a CardTransaction suggestion
 */
export interface CreateSubscriptionFromCardSuggestionInput {
  suggestion: CardTransactionSuggestion;
  selectedUserIds: string[];
  billingType?: string; // SMP-134: reflects the user's checkbox state
  totalLicenses?: number | null; // SMP-134: total seats entered by the user
}

/**
 * Build subscription suggestions from corporate card transactions
 * - Detects recurring patterns per matched app in CardTransaction
 * - Automatically includes the dominant card's team
 * - Provides team members as availableUsers
 * - SMP-123: uses the matchStatus field; supports linking to existing subscriptions
 */
export async function suggestFromCardTransactions(): Promise<
  ActionState<CardTransactionSuggestion[]>
> {
  const { organizationId } = await requireOrganization();
  const taxRatePercent = await getDefaultTaxRatePercent(organizationId);

  // 1. SMP-123: load app IDs that already have subscriptions, with subscription details (ID map)
  const existingSubscriptions = await prisma.subscription.findMany({
    where: { organizationId },
    select: { id: true, appId: true },
  });
  const appToSubscriptionMap = new Map(
    existingSubscriptions.map((s) => [s.appId, s.id])
  );

  // 2. Group CardTransactions from the last 12 months (uses matchStatus)
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const twelveMonthsAgoStr = twelveMonthsAgo
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");

  const transactionsByApp = await prisma.cardTransaction.groupBy({
    by: ["matchedAppId"],
    where: {
      organizationId,
      matchedAppId: { not: null },
      matchStatus: { in: ["AUTO_MATCHED", "MANUAL"] },
      useDt: { gte: twelveMonthsAgoStr },
    },
    _count: { id: true },
    _sum: { useAmt: true },
    _min: { useDt: true },
    _max: { useDt: true },
  });

  const suggestions: CardTransactionSuggestion[] = [];

  for (const group of transactionsByApp) {
    if (!group.matchedAppId) {
      continue;
    }

    // At least 2 required
    if (group._count.id < 2) {
      continue;
    }

    // Load app details (SMP-160: includes pricingModel, basePricePerSeat)
    const app = await prisma.app.findUnique({
      where: { id: group.matchedAppId },
      include: {
        catalog: {
          select: {
            logoUrl: true,
            pricingModel: true,
            basePricePerSeat: true,
          },
        },
      },
    });

    if (!app) continue;

    // SMP-123: load transaction details (includes linkedSubscriptionId)
    const transactions = await prisma.cardTransaction.findMany({
      where: {
        organizationId,
        matchedAppId: group.matchedAppId,
        matchStatus: { in: ["AUTO_MATCHED", "MANUAL"] },
        useDt: { gte: twelveMonthsAgoStr },
      },
      orderBy: { useDt: "asc" },
      select: {
        id: true,
        useDt: true,
        useAmt: true,
        teamId: true,
        userId: true,
        linkedSubscriptionId: true,
      },
    });

    // SMP-123: filter unlinked transactions
    const unmatchedTransactions = transactions.filter(
      (t) => t.linkedSubscriptionId === null
    );
    const unmatchedTransactionIds = unmatchedTransactions.map((t) => t.id);

    // SMP-123: check for an existing subscription
    const existingSubscriptionId = appToSubscriptionMap.get(group.matchedAppId);
    const hasExistingSubscription = !!existingSubscriptionId;

    // SMP-123: skip if a subscription exists and all transactions are linked
    if (hasExistingSubscription && unmatchedTransactionIds.length === 0) {
      continue;
    }

    // SMP-123: without a subscription at least 2 are needed; with one, any unlinked transaction is enough
    if (!hasExistingSubscription && transactions.length < 2) {
      continue;
    }

    // Load the dominant card (the most frequently used card)
    const dominantCardGroup = await prisma.cardTransaction.groupBy({
      by: ["corporateCardId"],
      where: {
        organizationId,
        matchedAppId: group.matchedAppId,
        useDt: { gte: twelveMonthsAgoStr },
      },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 1,
    });

    let teamId: string | null = null;
    let teamName: string | null = null;
    let availableUsers: AvailableUserWithTeam[] = [];

    // Phase 2: assignedUser details
    let assignedUserId: string | null = null;
    let assignedUserName: string | null = null;

    if (dominantCardGroup.length > 0) {
      const card = await prisma.corporateCard.findUnique({
        where: { id: dominantCardGroup[0].corporateCardId },
        include: {
          team: {
            include: {
              members: {
                where: { status: "ACTIVE" },
                select: { id: true, name: true, email: true, teamId: true },
              },
            },
          },
          // Phase 2: include the user assigned to the card
          assignedUser: {
            select: {
              id: true,
              name: true,
              email: true,
              team: { select: { id: true, name: true } },
            },
          },
        },
      });

      // Phase 2: prefer assignedUser when present
      if (card?.assignedUser) {
        assignedUserId = card.assignedUser.id;
        assignedUserName = card.assignedUser.name || card.assignedUser.email;
        // When a user is assigned, set teamId/teamName from that user's team
        if (card.assignedUser.team) {
          teamId = card.assignedUser.team.id;
          teamName = card.assignedUser.team.name;
          // SMP-134: fill availableUsers with the user's team members
          const teamWithMembers = await prisma.team.findUnique({
            where: { id: card.assignedUser.team.id },
            include: {
              members: {
                where: { status: "ACTIVE" },
                select: { id: true, name: true, email: true },
              },
            },
          });
          if (teamWithMembers) {
            availableUsers = mapMembersToAvailableUsers(
              teamWithMembers.members,
              card.assignedUser!.team!.id,
              card.assignedUser!.team!.name
            );
            availableUsers = await appendUnassignedUsers(
              availableUsers,
              organizationId
            );
          }
        } else {
          // SMP-134: fall back to all organization members when there is no team
          const allUsers = await prisma.user.findMany({
            where: { organizationId, status: "ACTIVE" },
            select: {
              id: true,
              name: true,
              email: true,
              teamId: true,
              team: { select: { name: true } },
            },
          });
          availableUsers = mapUsersWithOwnTeam(allUsers);
        }
      } else if (card?.team) {
        // Team-only assignment keeps the existing logic
        teamId = card.team.id;
        teamName = card.team.name;
        availableUsers = mapMembersToAvailableUsers(
          card.team.members,
          card.team!.id,
          card.team!.name
        );
        availableUsers = await appendUnassignedUsers(
          availableUsers,
          organizationId
        );
      }
    }

    // SMP-123: include CardTransaction team/user assignments in the dominant analysis
    // (covers cards without a CorporateCard assignment)
    if (!teamId && !assignedUserId) {
      const teamCounts = new Map<string, number>();
      const userCounts = new Map<string, number>();

      for (const tx of transactions) {
        if (tx.teamId) {
          teamCounts.set(tx.teamId, (teamCounts.get(tx.teamId) || 0) + 1);
        }
        if (tx.userId) {
          userCounts.set(tx.userId, (userCounts.get(tx.userId) || 0) + 1);
        }
      }

      // Dominant user first
      let maxUserCount = 0;
      let dominantUserId: string | null = null;
      for (const [uid, count] of userCounts) {
        if (count > maxUserCount) {
          maxUserCount = count;
          dominantUserId = uid;
        }
      }

      if (dominantUserId) {
        const user = await prisma.user.findUnique({
          where: { id: dominantUserId },
          select: {
            id: true,
            name: true,
            email: true,
            team: { select: { id: true, name: true } },
          },
        });
        if (user) {
          assignedUserId = user.id;
          assignedUserName = user.name || user.email;
          if (user.team) {
            teamId = user.team.id;
            teamName = user.team.name;
            // SMP-134: fill availableUsers with the user's team members
            const teamWithMembers = await prisma.team.findUnique({
              where: { id: user.team.id },
              include: {
                members: {
                  where: { status: "ACTIVE" },
                  select: { id: true, name: true, email: true },
                },
              },
            });
            if (teamWithMembers) {
              availableUsers = mapMembersToAvailableUsers(
                teamWithMembers.members,
                user.team!.id,
                user.team!.name
              );
              availableUsers = await appendUnassignedUsers(
                availableUsers,
                organizationId
              );
            }
          } else {
            // SMP-134: fall back to all organization members when there is no team
            const allUsers = await prisma.user.findMany({
              where: { organizationId, status: "ACTIVE" },
              select: {
                id: true,
                name: true,
                email: true,
                teamId: true,
                team: { select: { name: true } },
              },
            });
            availableUsers = mapUsersWithOwnTeam(allUsers);
          }
        }
      } else {
        // Dominant Team
        let maxTeamCount = 0;
        let dominantTeamId: string | null = null;
        for (const [tid, count] of teamCounts) {
          if (count > maxTeamCount) {
            maxTeamCount = count;
            dominantTeamId = tid;
          }
        }

        if (dominantTeamId) {
          const team = await prisma.team.findUnique({
            where: { id: dominantTeamId },
            include: {
              members: {
                where: { status: "ACTIVE" },
                select: { id: true, name: true, email: true },
              },
            },
          });
          if (team) {
            teamId = team.id;
            teamName = team.name;
            availableUsers = mapMembersToAvailableUsers(
              team.members,
              team.id,
              team.name
            );
            availableUsers = await appendUnassignedUsers(
              availableUsers,
              organizationId
            );
          }
        } else {
          // SMP-156: fall back to all active organization members when there is no team/user assignment
          const allUsers = await prisma.user.findMany({
            where: { organizationId, status: "ACTIVE" },
            select: {
              id: true,
              name: true,
              email: true,
              teamId: true,
              team: { select: { name: true } },
            },
          });
          availableUsers = mapUsersWithOwnTeam(allUsers);
        }
      }
    }

    // SMP-134: ensure assignedUserId is always included in availableUsers
    if (
      assignedUserId &&
      !availableUsers.some((u) => u.id === assignedUserId)
    ) {
      const assignedUserRecord = await prisma.user.findUnique({
        where: { id: assignedUserId },
        select: {
          id: true,
          name: true,
          email: true,
          teamId: true,
          team: { select: { name: true } },
        },
      });
      if (assignedUserRecord) {
        availableUsers = [
          {
            id: assignedUserRecord.id,
            name: assignedUserRecord.name,
            email: assignedUserRecord.email,
            teamId: assignedUserRecord.teamId ?? null,
            teamName: assignedUserRecord.team?.name ?? null,
          },
          ...availableUsers,
        ];
      }
    }

    // Analyse the billing cycle (reuses the existing function)
    const paymentsForAnalysis = transactions.map((t) => ({
      transactionDate: parseYYYYMMDD(t.useDt),
      amount: t.useAmt,
    }));
    const { billingCycle, confidence } =
      analyzeBillingCycle(paymentsForAnalysis);

    // Calculate the average amount
    const avgAmount =
      transactions.reduce((sum, t) => sum + Number(t.useAmt), 0) /
      transactions.length;

    // SMP-134/SMP-160: auto-detect seat-based subscriptions (includes catalogue data)
    const txAmounts = transactions.map((t) => Number(t.useAmt));
    const cardSeatDetection = detectBillingType({
      appName: app.name,
      amounts: txAmounts,
      catalogPricingModel: app.catalog?.pricingModel ?? null,
      catalogBasePricePerSeat: app.catalog?.basePricePerSeat
        ? Number(app.catalog.basePricePerSeat)
        : null,
      taxRatePercent,
    });

    // Filter confidence >= 0.5
    if (confidence >= 0.5) {
      // SMP-123: determine suggestedAction
      const suggestedAction: SuggestedAction = existingSubscriptionId
        ? "link"
        : "create";

      suggestions.push({
        appId: app.id,
        appName: app.name,
        appLogoUrl: app.customLogoUrl || app.catalog?.logoUrl || null,
        suggestedBillingCycle: billingCycle,
        suggestedAmount: Math.round(avgAmount),
        // CardTransaction has no currency column → organisation base currency
        currency: await getBaseCurrency(organizationId),
        paymentCount: transactions.length,
        firstPaymentDate: parseYYYYMMDD(group._min.useDt!),
        lastPaymentDate: parseYYYYMMDD(group._max.useDt!),
        confidence,
        // SMP-134/SMP-160: seat-based subscription detection
        billingType: cardSeatDetection.billingType,
        perSeatPrice: cardSeatDetection.perSeatPrice,
        suggestedSeats: cardSeatDetection.suggestedSeats,
        seatDetectionMethod: cardSeatDetection.method,
        seatDetectionConfidence: cardSeatDetection.confidence,
        teamId,
        teamName,
        assignedUserId,
        assignedUserName,
        availableUsers,
        source: "card_transaction",
        // SMP-123: additional fields
        existingSubscriptionId,
        suggestedAction,
        unmatchedTransactionIds,
      });
    }
  }

  // Sort by confidence, highest first
  suggestions.sort((a, b) => b.confidence - a.confidence);

  return { success: true, data: suggestions };
}

/**
 * Create or link a subscription from a CardTransaction suggestion (team auto-assignment + manual user selection)
 * SMP-123: performs a create or link action based on suggestedAction
 */
async function _createSubscriptionFromCardSuggestion(
  input: CreateSubscriptionFromCardSuggestionInput
): Promise<ActionState<{ id: string }>> {
  const {
    suggestion,
    selectedUserIds,
    billingType: overrideBillingType,
    totalLicenses: overrideTotalLicenses,
  } = input;
  const { organizationId, userId } = await requireOrganization();

  if (!(await can("subscriptions:create"))) {
    return { success: false, message: NO_CREATE_PERMISSION };
  }
  // Assigning seats to other members needs subscriptions:assign
  if (selectedUserIds.length > 0 && !(await can("subscriptions:assign"))) {
    return { success: false, message: NO_ASSIGN_PERMISSION };
  }

  const app = await prisma.app.findFirst({
    where: { id: suggestion.appId, organizationId },
  });

  if (!app) {
    return { success: false, message: "App not found" };
  }

  // SMP-123: check for an existing subscription
  const existingSubscription = await prisma.subscription.findFirst({
    where: { appId: suggestion.appId, organizationId },
  });

  // SMP-123: suggestedAction link - only link transactions to the existing subscription
  if (suggestion.suggestedAction === "link" && existingSubscription) {
    // Link transactions
    if (suggestion.unmatchedTransactionIds.length > 0) {
      await prisma.cardTransaction.updateMany({
        where: { id: { in: suggestion.unmatchedTransactionIds } },
        data: { linkedSubscriptionId: existingSubscription.id },
      });
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: "LINK_CARD_TRANSACTIONS",
        entityType: "Subscription",
        entityId: existingSubscription.id,
        userId,
        organizationId,
        metadata: {
          appName: app.name,
          linkedTransactionCount: suggestion.unmatchedTransactionIds.length,
        },
      },
    });

    revalidatePath("/subscriptions");
    revalidatePath("/payments");

    return { success: true, data: { id: existingSubscription.id } };
  }

  // suggestedAction create - create a new subscription
  if (existingSubscription) {
    return {
      success: false,
      message: "A subscription for this app already exists",
    };
  }

  // SMP-123: auto-assign App-Team
  await ensureAppTeamAssignment(suggestion.appId, suggestion.teamId);

  // Phase 2: add assignedUserId to the users to assign, when present
  const userIdsToAssign = new Set(selectedUserIds);
  if (suggestion.assignedUserId) {
    userIdsToAssign.add(suggestion.assignedUserId);
  }
  const finalUserIds = Array.from(userIdsToAssign);
  let userTeamIds: string[] = [];

  // Validate selected users (must belong to the organization)
  if (finalUserIds.length > 0) {
    const validUsers = await prisma.user.findMany({
      where: {
        id: { in: finalUserIds },
        organizationId,
      },
      select: { id: true, teamId: true },
    });

    if (validUsers.length !== finalUserIds.length) {
      return {
        success: false,
        message: "One or more users are invalid",
      };
    }

    // SMP-134: auto-link team and app when assigning users
    userTeamIds = validUsers
      .filter((u) => u.teamId != null)
      .map((u) => u.teamId as string);
    if (userTeamIds.length > 0) {
      const existingAppTeams = await prisma.appTeam.findMany({
        where: { appId: suggestion.appId, teamId: { in: userTeamIds } },
        select: { teamId: true },
      });
      const existingTeamIds = new Set(existingAppTeams.map((at) => at.teamId));
      const missingTeamIds = [
        ...new Set(userTeamIds.filter((id) => !existingTeamIds.has(id))),
      ];
      if (missingTeamIds.length > 0) {
        await prisma.appTeam.createMany({
          data: missingTeamIds.map((teamId) => ({
            appId: suggestion.appId,
            teamId,
            assignedBy: userId,
          })),
          skipDuplicates: true,
        });
      }
    }
  }

  // SMP-134: billingType/totalLicenses overrides
  const finalBillingType =
    (overrideBillingType as "FLAT_RATE" | "PER_SEAT") || suggestion.billingType;
  // SMP-160: no auto-fill from suggestedSeats — use override values only
  const finalTotalLicenses =
    overrideTotalLicenses !== undefined ? overrideTotalLicenses : null;

  const renewalDate = calculateNextRenewalDate(
    suggestion.lastPaymentDate,
    suggestion.suggestedBillingCycle
  );

  const subscription = await prisma.subscription.create({
    data: {
      appId: suggestion.appId,
      organizationId,
      teamId: suggestion.teamId,
      status: "ACTIVE",
      billingCycle: suggestion.suggestedBillingCycle,
      billingType: finalBillingType,
      amount: suggestion.suggestedAmount,
      perSeatPrice: suggestion.perSeatPrice,
      currency: suggestion.currency,
      totalLicenses: finalTotalLicenses,
      usedLicenses: finalUserIds.length > 0 ? finalUserIds.length : null,
      startDate: suggestion.firstPaymentDate,
      renewalDate,
      autoRenewal: true,
      renewalAlert30: true,
      notes: `Auto-created from corporate card transactions (${suggestion.paymentCount} transactions analysed, ${Math.round(suggestion.confidence * 100)}% confidence)`,
    },
  });

  // Create SubscriptionTeam (when suggestion.teamId is set)
  if (suggestion.teamId) {
    await prisma.subscriptionTeam.create({
      data: {
        subscriptionId: subscription.id,
        teamId: suggestion.teamId,
        assignedBy: userId,
      },
    });
  }

  // SMP-123: link CardTransaction.linkedSubscriptionId
  if (suggestion.unmatchedTransactionIds.length > 0) {
    await prisma.cardTransaction.updateMany({
      where: { id: { in: suggestion.unmatchedTransactionIds } },
      data: { linkedSubscriptionId: subscription.id },
    });
  }

  // Create SubscriptionUser records
  if (finalUserIds.length > 0) {
    await prisma.subscriptionUser.createMany({
      data: finalUserIds.map((uid) => ({
        subscriptionId: subscription.id,
        userId: uid,
        assignedBy: userId,
      })),
      skipDuplicates: true,
    });

    // SMP-180: user's team → auto-link SubscriptionTeam (when suggestion.teamId is absent)
    if (!suggestion.teamId && userTeamIds.length > 0) {
      const uniqueUserTeamIds = [...new Set(userTeamIds)];
      await prisma.subscriptionTeam.createMany({
        data: uniqueUserTeamIds.map((tid) => ({
          subscriptionId: subscription.id,
          teamId: tid,
          assignedBy: userId,
        })),
        skipDuplicates: true,
      });

      // Dual-write: update subscription.teamId (first team)
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { teamId: uniqueUserTeamIds[0] },
      });
    }
  }

  // SMP-160: include the seat detection result in the audit log
  const cardSeatDetectionLog = {
    billingType: suggestion.billingType,
    perSeatPrice: suggestion.perSeatPrice,
    suggestedSeats: suggestion.suggestedSeats,
    method: suggestion.seatDetectionMethod ?? null,
    confidence: suggestion.seatDetectionConfidence ?? null,
    overridden: overrideBillingType
      ? overrideBillingType !== suggestion.billingType
      : false,
    overriddenTo: overrideBillingType ?? null,
  };

  await prisma.auditLog.create({
    data: {
      action: "CREATE_SUBSCRIPTION",
      entityType: "Subscription",
      entityId: subscription.id,
      userId,
      organizationId,
      metadata: {
        appName: app.name,
        source: "card_transaction_suggestion",
        confidence: suggestion.confidence,
        teamId: suggestion.teamId,
        assignedUserId: suggestion.assignedUserId,
        assignedUserCount: finalUserIds.length,
        linkedTransactionCount: suggestion.unmatchedTransactionIds.length,
        seatDetection: cardSeatDetectionLog,
      },
    },
  });

  revalidatePath("/subscriptions");
  revalidatePath("/payments");

  return { success: true, data: { id: subscription.id } };
}
export const createSubscriptionFromCardSuggestion = withLogging(
  "createSubscriptionFromCardSuggestion",
  _createSubscriptionFromCardSuggestion
);
