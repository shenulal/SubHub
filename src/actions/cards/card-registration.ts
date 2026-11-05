"use server";

import { getCachedSession } from "@/lib/auth/require-auth";
import { encryptJson, getCardLast4, maskCardNumber } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import {
  CARD_COMPANIES,
  type CardCompanyCode,
  type CardCredentials,
} from "@/lib/services/hyphen";
import type { ActionState } from "@/types";
import type { CorporateCard } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { cache } from "react";
import { z } from "zod";

// ==================== Schema definitions ====================

const registerCardSchema = z.object({
  cardCd: z.string().min(3).max(3),
  cardNo: z.string().min(14).max(20),
  cardNm: z.string().nullable().optional(),
  loginMethod: z.enum(["ID", "CERT"]),
  userId: z.string().nullable().optional(), // Card issuer login ID
  userPw: z.string().nullable().optional(),
  signCert: z.string().nullable().optional(),
  signPri: z.string().nullable().optional(),
  signPw: z.string().nullable().optional(),
  bizNo: z.string().nullable().optional(),
  userIdx: z.string().nullable().optional(),
  teamId: z.string().nullable().optional(),
  assignedUserId: z.string().nullable().optional(), // Assigned user ID
});

// ==================== Corporate card registration ====================

/**
 * Register a corporate card
 */
async function _registerCorporateCard(
  formData: FormData
): Promise<ActionState<{ id: string }>> {
  try {
    const session = await getCachedSession();
    if (!session?.user?.organizationId) {
      return { success: false, message: "Authentication required" };
    }
    if (session.user.role !== "ADMIN") {
      return { success: false, message: "Only admins can register cards" };
    }

    const organizationId = session.user.organizationId;

    // Parse FormData
    const rawData = {
      cardCd: formData.get("cardCd") as string,
      cardNo: formData.get("cardNo") as string,
      cardNm: formData.get("cardNm") as string | null,
      loginMethod: formData.get("loginMethod") as string,
      userId: formData.get("userId") as string | null, // Card issuer login ID
      userPw: formData.get("userPw") as string | null,
      signCert: formData.get("signCert") as string | null,
      signPri: formData.get("signPri") as string | null,
      signPw: formData.get("signPw") as string,
      bizNo: formData.get("bizNo") as string | null,
      userIdx: formData.get("userIdx") as string | null,
      teamId: (formData.get("teamId") as string) || null,
      assignedUserId: (formData.get("assignedUserId") as string) || null, // Assigned user ID
    };

    // Validation
    const result = registerCardSchema.safeParse(rawData);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      const errorMessages = Object.entries(fieldErrors)
        .map(([field, errors]) => `${field}: ${errors?.join(", ")}`)
        .join("; ");
      return {
        success: false,
        message: `Input validation failed: ${errorMessages}`,
        errors: fieldErrors as Record<string, string[]>,
      };
    }

    const data = result.data;

    // Duplicate check
    const existingCard = await prisma.corporateCard.findFirst({
      where: {
        organizationId,
        cardNo: maskCardNumber(data.cardNo),
      },
    });

    if (existingCard) {
      return { success: false, message: "This card is already registered" };
    }

    // Validate required fields per login method
    if (data.loginMethod === "ID") {
      if (!data.userId || !data.userPw) {
        return {
          success: false,
          message: "User ID and password are required for ID login",
        };
      }
    } else if (data.loginMethod === "CERT") {
      if (!data.signCert || !data.signPri || !data.signPw) {
        return {
          success: false,
          message:
            "Certificate, private key and password are required for certificate login",
        };
      }
    }

    // Team and user assignments are mutually exclusive
    if (data.teamId && data.assignedUserId) {
      return {
        success: false,
        message: "Select either a team or a user assignment, not both",
      };
    }

    // Validate the team (when teamId is set)
    if (data.teamId) {
      const team = await prisma.team.findFirst({
        where: {
          id: data.teamId,
          organizationId,
        },
      });

      if (!team) {
        return {
          success: false,
          message: "Invalid team",
        };
      }
    }

    // Validate the user (when assignedUserId is set)
    if (data.assignedUserId) {
      const user = await prisma.user.findFirst({
        where: {
          id: data.assignedUserId,
          organizationId,
        },
      });

      if (!user) {
        return {
          success: false,
          message: "Invalid user",
        };
      }
    }

    // Encrypt credentials (including the original card number)
    const credentials: CardCredentials =
      data.loginMethod === "ID"
        ? {
            loginMethod: "ID",
            cardNo: data.cardNo,
            userId: data.userId!,
            userPw: data.userPw!,
            bizNo: data.bizNo || undefined,
            userIdx: data.userIdx || undefined,
          }
        : {
            loginMethod: "CERT",
            cardNo: data.cardNo,
            signCert: data.signCert!,
            signPri: data.signPri!,
            signPw: data.signPw!,
            bizNo: data.bizNo || undefined,
            userIdx: data.userIdx || undefined,
          };

    const encryptedCredentials = encryptJson(credentials);

    // Register the card
    const card = await prisma.corporateCard.create({
      data: {
        organizationId,
        cardCd: data.cardCd,
        cardNo: maskCardNumber(data.cardNo),
        cardLast4: getCardLast4(data.cardNo),
        cardNm: data.cardNm || CARD_COMPANIES[data.cardCd as CardCompanyCode],
        loginMethod: data.loginMethod,
        encryptedCredentials,
        bizNo: data.bizNo,
        teamId: data.teamId,
        assignedUserId: data.assignedUserId,
        isActive: true,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: "CREATE_CORPORATE_CARD",
        entityType: "CorporateCard",
        entityId: card.id,
        userId: session.user.id,
        organizationId,
        metadata: {
          cardCd: data.cardCd,
          cardLast4: getCardLast4(data.cardNo),
          teamId: data.teamId,
          assignedUserId: data.assignedUserId,
        },
      },
    });

    revalidatePath("/payments/cards");

    return { success: true, data: { id: card.id } };
  } catch (error) {
    logger.error({ err: error }, "Corporate card registration failed");
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      message: `Failed to register the corporate card: ${errorMessage}`,
    };
  }
}
export const registerCorporateCard = withLogging(
  "registerCorporateCard",
  _registerCorporateCard
);

// ==================== Corporate card queries ====================

/**
 * Transaction classification summary (SaaS/Non-SaaS/unclassified)
 */
export interface CardTransactionSummary {
  totalCount: number;
  saasMatchedCount: number;
  nonSaaSCount: number;
  unmatchedCount: number;
}

/**
 * Assignment info type
 */
export interface CardAssignment {
  type: "none" | "team" | "user";
  teamId: string | null;
  teamName: string | null;
  userId: string | null;
  userName: string | null;
  userTeamName: string | null; // The user's team when assigned to a user
}

/**
 * Corporate card list type
 */
export type CorporateCardWithCount = CorporateCard & {
  _count: { transactions: number };
  summary?: CardTransactionSummary;
  assignment?: CardAssignment;
};

/**
 * Fetch the transaction classification summary per card
 */
export async function getCardTransactionSummary(
  organizationId: string,
  cardId: string
): Promise<CardTransactionSummary> {
  const { normalizeMerchantName } =
    await import("@/lib/services/payment/merchant-matcher");
  const { checkNonSaaSCache } = await import("@/lib/services/saas-matcher");

  const transactions = await prisma.cardTransaction.findMany({
    where: { corporateCardId: cardId, organizationId },
    select: {
      id: true,
      useStore: true,
      matchedAppId: true,
    },
  });

  if (transactions.length === 0) {
    return {
      totalCount: 0,
      saasMatchedCount: 0,
      nonSaaSCount: 0,
      unmatchedCount: 0,
    };
  }

  const saasMatchedCount = transactions.filter(
    (t) => t.matchedAppId !== null
  ).length;

  const normalizedNames = transactions
    .filter((t) => t.matchedAppId === null)
    .map((t) => normalizeMerchantName(t.useStore));

  const nonSaaSSet = await checkNonSaaSCache(organizationId, normalizedNames);

  let nonSaaSCount = 0;
  let unmatchedCount = 0;

  for (const t of transactions) {
    if (t.matchedAppId !== null) continue;
    const normalized = normalizeMerchantName(t.useStore);
    if (nonSaaSSet.has(normalized)) {
      nonSaaSCount++;
    } else {
      unmatchedCount++;
    }
  }

  return {
    totalCount: transactions.length,
    saasMatchedCount,
    nonSaaSCount,
    unmatchedCount,
  };
}

/**
 * Fetch corporate cards
 */
export async function getCorporateCards(): Promise<CorporateCardWithCount[]> {
  const session = await getCachedSession();
  if (!session?.user?.organizationId) {
    return [];
  }

  const cards = await prisma.corporateCard.findMany({
    where: {
      organizationId: session.user.organizationId,
    },
    include: {
      _count: {
        select: { transactions: true },
      },
      team: {
        select: { id: true, name: true },
      },
      assignedUser: {
        select: {
          id: true,
          name: true,
          email: true,
          team: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const cardsWithSummary = await Promise.all(
    cards.map(async (card) => {
      const summary = await getCardTransactionSummary(
        session.user.organizationId!,
        card.id
      );

      // Build assignment info
      let assignment: CardAssignment;
      if (card.assignedUser) {
        assignment = {
          type: "user",
          teamId: null,
          teamName: null,
          userId: card.assignedUser.id,
          userName: card.assignedUser.name || card.assignedUser.email,
          userTeamName: card.assignedUser.team?.name ?? null,
        };
      } else if (card.team) {
        assignment = {
          type: "team",
          teamId: card.team.id,
          teamName: card.team.name,
          userId: null,
          userName: null,
          userTeamName: null,
        };
      } else {
        assignment = {
          type: "none",
          teamId: null,
          teamName: null,
          userId: null,
          userName: null,
          userTeamName: null,
        };
      }

      return { ...card, summary, assignment };
    })
  );

  return cardsWithSummary;
}

/**
 * Fetch corporate card details
 */
export async function getCorporateCard(
  cardId: string
): Promise<CorporateCard | null> {
  const session = await getCachedSession();
  if (!session?.user?.organizationId) {
    return null;
  }

  return prisma.corporateCard.findFirst({
    where: {
      id: cardId,
      organizationId: session.user.organizationId,
    },
  });
}

// Cached so repeated card-detail lookups within one request hit the DB only once
export const getCorporateCardCached = cache(getCorporateCard);

// ==================== Corporate card deletion ====================

/**
 * Delete a corporate card
 */
async function _deleteCorporateCard(cardId: string): Promise<ActionState> {
  try {
    const session = await getCachedSession();
    if (!session?.user?.organizationId) {
      return { success: false, message: "Authentication required" };
    }
    if (session.user.role !== "ADMIN") {
      return { success: false, message: "Only admins can delete cards" };
    }

    const organizationId = session.user.organizationId;

    const card = await prisma.corporateCard.findFirst({
      where: {
        id: cardId,
        organizationId,
      },
    });

    if (!card) {
      return { success: false, message: "Card not found" };
    }

    await prisma.corporateCard.delete({
      where: { id: cardId },
    });

    await prisma.auditLog.create({
      data: {
        action: "DELETE_CORPORATE_CARD",
        entityType: "CorporateCard",
        entityId: cardId,
        userId: session.user.id,
        organizationId,
        metadata: {
          cardCd: card.cardCd,
          cardLast4: card.cardLast4,
        },
      },
    });

    revalidatePath("/payments/cards");

    return { success: true };
  } catch (error) {
    logger.error({ err: error }, "Corporate card deletion failed");
    return { success: false, message: "Failed to delete the corporate card" };
  }
}
export const deleteCorporateCard = withLogging(
  "deleteCorporateCard",
  _deleteCorporateCard
);

// ==================== Corporate card update ====================

/**
 * Update a corporate card's team assignment
 */
async function _updateCorporateCardTeam(
  cardId: string,
  teamId: string | null
): Promise<ActionState> {
  try {
    const session = await getCachedSession();
    if (!session?.user?.organizationId) {
      return { success: false, message: "Authentication required" };
    }
    if (session.user.role !== "ADMIN") {
      return { success: false, message: "Only admins can edit cards" };
    }

    const organizationId = session.user.organizationId;

    const card = await prisma.corporateCard.findFirst({
      where: {
        id: cardId,
        organizationId,
      },
    });

    if (!card) {
      return { success: false, message: "Card not found" };
    }

    // Validate the team (when teamId is set)
    if (teamId) {
      const team = await prisma.team.findFirst({
        where: {
          id: teamId,
          organizationId,
        },
      });

      if (!team) {
        return { success: false, message: "Invalid team" };
      }
    }

    await prisma.corporateCard.update({
      where: { id: cardId },
      data: { teamId },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE_CORPORATE_CARD",
        entityType: "CorporateCard",
        entityId: cardId,
        userId: session.user.id,
        organizationId,
        metadata: {
          cardCd: card.cardCd,
          cardLast4: card.cardLast4,
          teamId,
        },
      },
    });

    revalidatePath("/payments/cards");

    return { success: true, message: "Card team assignment updated" };
  } catch (error) {
    logger.error({ err: error }, "Corporate card update failed");
    return { success: false, message: "Failed to update the corporate card" };
  }
}
export const updateCorporateCardTeam = withLogging(
  "updateCorporateCardTeam",
  _updateCorporateCardTeam
);
