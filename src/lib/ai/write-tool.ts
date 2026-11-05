/**
 * SubHub AI Agent Write Tool
 * SMP-198: designed on the actual SMP Server Actions + Prisma schema
 * SMP-205: added user assign/remove Write Tools
 *
 * App: createAppSchema (name, category, customWebsite, notes, tags, ownerId, catalogId, teamIds)
 * Subscription: createSubscriptionSchema (appId, billingCycle, billingType, amount, currency,
 *   totalLicenses, usedLicenses, startDate, endDate, renewalDate, autoRenewal, notes, teamIds, assignedUserIds)
 * Suggestion: createSubscriptionFromSuggestion (by appId, auto-created from suggestion data)
 *
 * [Fix] AI SDK v6: the tool({ inputSchema }) key is required (parameters is not supported)
 * [Fix] the jsonSchema() helper guarantees Anthropic input_schema.type: "object"
 */

import { DEFAULT_BASE_CURRENCY } from "@/lib/fx/convert";
import { jsonSchema, tool } from "ai";
import { nanoid } from "nanoid";

import type {
  WriteToolParams,
  WriteToolPendingAction,
  WriteToolResult,
} from "./write-tool.types";

// ==================== Create pending-approval actions ====================

export function createPendingAction(
  params: WriteToolParams,
  description: string,
  impact?: string
): WriteToolPendingAction {
  return {
    id: nanoid(),
    action: params.action,
    params,
    description,
    impact,
    createdAt: new Date(),
  };
}

// ==================== AI SDK Write Tools ====================

export const writeTools = {
  create_app: tool({
    description:
      "Registers a new SaaS app. The app name is required; category, website, notes, etc. are optional. Requires ADMIN or MEMBER role. User approval is required before execution.",
    inputSchema: jsonSchema<{
      name: string;
      category?: string;
      customWebsite?: string;
      notes?: string;
      tags?: string;
    }>({
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "App name (2-100 characters, required)",
        },
        category: {
          type: "string",
          description:
            "Category (e.g. Development Tools, Design, Marketing, Communication)",
        },
        customWebsite: {
          type: "string",
          description: "App website URL",
        },
        notes: {
          type: "string",
          description: "Notes (max 1000 characters)",
        },
        tags: {
          type: "string",
          description: "Tags (comma-separated)",
        },
      },
      required: ["name"],
    }),
    execute: async (params) => {
      const pending = createPendingAction(
        { action: "create_app", ...params },
        `Register the new app "${params.name}".`,
        [
          params.category && `Category: ${params.category}`,
          params.customWebsite && `Website: ${params.customWebsite}`,
        ]
          .filter(Boolean)
          .join(", ") || undefined
      );
      return { type: "pending_approval" as const, pendingAction: pending };
    },
  }),

  update_app: tool({
    description:
      "Updates an existing SaaS app. The app ID is required. Requires ADMIN role. User approval is required before execution.",
    inputSchema: jsonSchema<{
      id: string;
      name?: string;
      category?: string;
      customWebsite?: string;
      notes?: string;
      tags?: string;
      status?: "ACTIVE" | "INACTIVE" | "PENDING_REVIEW" | "BLOCKED";
    }>({
      type: "object",
      properties: {
        id: { type: "string", description: "ID of the app to update" },
        name: { type: "string", description: "New app name" },
        category: { type: "string", description: "New category" },
        customWebsite: { type: "string", description: "New website URL" },
        notes: { type: "string", description: "New notes" },
        tags: { type: "string", description: "New tags" },
        status: {
          type: "string",
          enum: ["ACTIVE", "INACTIVE", "PENDING_REVIEW", "BLOCKED"],
          description: "App status",
        },
      },
      required: ["id"],
    }),
    execute: async (params) => {
      const changes = Object.entries(params)
        .filter(([k, v]) => k !== "id" && v !== undefined)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
      const pending = createPendingAction(
        { action: "update_app", ...params },
        `Update app (ID: ${params.id}).`,
        changes || undefined
      );
      return { type: "pending_approval" as const, pendingAction: pending };
    },
  }),

  delete_app: tool({
    description:
      "Deletes a SaaS app. Linked subscriptions and user access are deleted as well. Requires ADMIN role. User approval is required before execution.",
    inputSchema: jsonSchema<{ id: string; name: string }>({
      type: "object",
      properties: {
        id: { type: "string", description: "ID of the app to delete" },
        name: {
          type: "string",
          description: "Name of the app to delete (for confirmation)",
        },
      },
      required: ["id", "name"],
    }),
    execute: async (params) => {
      const pending = createPendingAction(
        { action: "delete_app", ...params },
        `Delete the app "${params.name}".`,
        "Linked subscriptions and user access will also be deleted. This action cannot be undone."
      );
      return { type: "pending_approval" as const, pendingAction: pending };
    },
  }),

  create_subscription: tool({
    description:
      "Registers a new subscription for an app. App ID, billing cycle (MONTHLY/QUARTERLY/YEARLY/ONE_TIME), amount and start date are required. Requires ADMIN or MEMBER role. User approval is required before execution.",
    inputSchema: jsonSchema<{
      appId: string;
      appName: string;
      billingCycle: "MONTHLY" | "QUARTERLY" | "YEARLY" | "ONE_TIME";
      billingType?: "FLAT_RATE" | "PER_SEAT";
      amount: string;
      currency?: string;
      startDate: string;
      endDate?: string;
      totalLicenses?: number;
      autoRenewal?: boolean;
      notes?: string;
    }>({
      type: "object",
      properties: {
        appId: { type: "string", description: "ID of the app to subscribe to" },
        appName: { type: "string", description: "App name (for confirmation)" },
        billingCycle: {
          type: "string",
          enum: ["MONTHLY", "QUARTERLY", "YEARLY", "ONE_TIME"],
          description: "Billing cycle",
        },
        billingType: {
          type: "string",
          enum: ["FLAT_RATE", "PER_SEAT"],
          description: "Billing type (default: FLAT_RATE)",
        },
        amount: {
          type: "string",
          description: "Amount (numeric string, e.g. '20000')",
        },
        currency: {
          type: "string",
          description: `Currency (default: ${DEFAULT_BASE_CURRENCY})`,
        },
        startDate: {
          type: "string",
          description: "Start date (YYYY-MM-DD)",
        },
        endDate: {
          type: "string",
          description: "End date (YYYY-MM-DD, optional)",
        },
        totalLicenses: {
          type: "number",
          description: "Total licences (for PER_SEAT)",
        },
        autoRenewal: {
          type: "boolean",
          description: "Auto-renewal (default: true)",
        },
        notes: {
          type: "string",
          description: "Notes",
        },
      },
      required: ["appId", "appName", "billingCycle", "amount", "startDate"],
    }),
    execute: async (params) => {
      const cycleLabel: Record<string, string> = {
        MONTHLY: "Monthly",
        QUARTERLY: "Quarterly",
        YEARLY: "Yearly",
        ONE_TIME: "One-time",
      };
      const pending = createPendingAction(
        { action: "create_subscription", ...params },
        `Register a subscription for "${params.appName}".`,
        `${cycleLabel[params.billingCycle] ?? params.billingCycle} / ${Number(params.amount).toLocaleString()} ${params.currency ?? DEFAULT_BASE_CURRENCY} / Start: ${params.startDate}`
      );
      return { type: "pending_approval" as const, pendingAction: pending };
    },
  }),

  update_subscription: tool({
    description:
      "Updates an existing subscription. The subscription ID is required. Requires ADMIN or MEMBER role. User approval is required before execution.",
    inputSchema: jsonSchema<{
      id: string;
      billingCycle?: "MONTHLY" | "QUARTERLY" | "YEARLY" | "ONE_TIME";
      billingType?: "FLAT_RATE" | "PER_SEAT";
      amount?: string;
      currency?: string;
      totalLicenses?: number;
      status?: "ACTIVE" | "EXPIRED" | "CANCELLED" | "PENDING";
      autoRenewal?: boolean;
      notes?: string;
    }>({
      type: "object",
      properties: {
        id: { type: "string", description: "ID of the subscription to update" },
        billingCycle: {
          type: "string",
          enum: ["MONTHLY", "QUARTERLY", "YEARLY", "ONE_TIME"],
          description: "New billing cycle",
        },
        billingType: {
          type: "string",
          enum: ["FLAT_RATE", "PER_SEAT"],
          description: "New billing type",
        },
        amount: { type: "string", description: "New amount" },
        currency: { type: "string", description: "New currency" },
        totalLicenses: { type: "number", description: "New total licences" },
        status: {
          type: "string",
          enum: ["ACTIVE", "EXPIRED", "CANCELLED", "PENDING"],
          description: "Subscription status",
        },
        autoRenewal: { type: "boolean", description: "Auto-renewal" },
        notes: { type: "string", description: "Notes" },
      },
      required: ["id"],
    }),
    execute: async (params) => {
      const changes = Object.entries(params)
        .filter(([k, v]) => k !== "id" && v !== undefined)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
      const pending = createPendingAction(
        { action: "update_subscription", ...params },
        `Update subscription (ID: ${params.id}).`,
        changes || undefined
      );
      return { type: "pending_approval" as const, pendingAction: pending };
    },
  }),

  delete_subscription: tool({
    description:
      "Deletes a subscription. Requires ADMIN role. User approval is required before execution.",
    inputSchema: jsonSchema<{ id: string; appName: string }>({
      type: "object",
      properties: {
        id: { type: "string", description: "ID of the subscription to delete" },
        appName: { type: "string", description: "App name (for confirmation)" },
      },
      required: ["id", "appName"],
    }),
    execute: async (params) => {
      const pending = createPendingAction(
        { action: "delete_subscription", ...params },
        `Delete the subscription for "${params.appName}".`,
        "This action cannot be undone."
      );
      return { type: "pending_approval" as const, pendingAction: pending };
    },
  }),

  confirm_subscription_suggestion: tool({
    description:
      "Confirms a subscription suggestion and registers it as a subscription. First fetch suggestions with get_subscription_suggestions, confirm the seat count and assigned users with the user, then call this tool. suggestionSource distinguishes payment-based (payment_record) from card-based (card_transaction) suggestions. User approval is required before execution.",
    inputSchema: jsonSchema<{
      appId: string;
      appName: string;
      suggestionSource: "payment_record" | "card_transaction";
      selectedUserIds?: string[];
      billingType?: "FLAT_RATE" | "PER_SEAT";
      totalLicenses?: number;
    }>({
      type: "object",
      properties: {
        appId: {
          type: "string",
          description: "Suggested app ID",
        },
        appName: {
          type: "string",
          description: "App name (for confirmation)",
        },
        suggestionSource: {
          type: "string",
          enum: ["payment_record", "card_transaction"],
          description:
            "Suggestion source. Use the source value from the get_subscription_suggestions result",
        },
        selectedUserIds: {
          type: "array",
          items: { type: "string" },
          description:
            "IDs of users to assign. Choose from availableUsers in get_subscription_suggestions",
        },
        billingType: {
          type: "string",
          enum: ["FLAT_RATE", "PER_SEAT"],
          description:
            "Billing type override. Use only when it differs from the suggested value",
        },
        totalLicenses: {
          type: "number",
          description:
            "Total seats (for PER_SEAT). Use the value specified by the user",
        },
      },
      required: ["appId", "appName", "suggestionSource"],
    }),
    execute: async (params) => {
      const details = [
        params.billingType && `Billing type: ${params.billingType}`,
        params.totalLicenses && `Seats: ${params.totalLicenses}`,
        params.selectedUserIds?.length &&
          `Assigned users: ${params.selectedUserIds.length}`,
      ]
        .filter(Boolean)
        .join(", ");
      const pending = createPendingAction(
        { action: "confirm_suggestion", ...params },
        `Confirm the suggestion for "${params.appName}" and register it as a subscription.`,
        details ||
          "Suggestion details (amount, billing cycle, seat assessment, etc.) will be applied automatically."
      );
      return { type: "pending_approval" as const, pendingAction: pending };
    },
  }),

  assign_user_to_subscription: tool({
    description:
      "Assigns a user to a subscription. Users can be assigned to every subscription type (FLAT_RATE, PER_SEAT), regardless of billingType. PER_SEAT subscriptions may have a seat limit; FLAT_RATE subscriptions allow unlimited assignments. First look up the subscription ID with search_subscriptions and the user ID with get_users. User approval is required before execution.",
    inputSchema: jsonSchema<{
      subscriptionId: string;
      subscriptionName: string;
      userId: string;
      userName: string;
    }>({
      type: "object",
      properties: {
        subscriptionId: {
          type: "string",
          description: "ID of the subscription to assign to",
        },
        subscriptionName: {
          type: "string",
          description: "Subscription name (for confirmation; the app name)",
        },
        userId: {
          type: "string",
          description: "ID of the user to assign",
        },
        userName: {
          type: "string",
          description: "User name (for confirmation)",
        },
      },
      required: ["subscriptionId", "subscriptionName", "userId", "userName"],
    }),
    execute: async (params) => {
      const pending = createPendingAction(
        { action: "assign_user", ...params },
        `Assign ${params.userName} to the "${params.subscriptionName}" subscription.`,
        undefined
      );
      return { type: "pending_approval" as const, pendingAction: pending };
    },
  }),

  remove_user_from_subscription: tool({
    description:
      "Removes a user from a subscription. Only assigned users can be removed. Check the assigned user list in the subscription details first. User approval is required before execution.",
    inputSchema: jsonSchema<{
      subscriptionId: string;
      subscriptionName: string;
      userId: string;
      userName: string;
    }>({
      type: "object",
      properties: {
        subscriptionId: {
          type: "string",
          description: "Subscription ID",
        },
        subscriptionName: {
          type: "string",
          description: "Subscription name (for confirmation; the app name)",
        },
        userId: {
          type: "string",
          description: "ID of the user to remove",
        },
        userName: {
          type: "string",
          description: "User name (for confirmation)",
        },
      },
      required: ["subscriptionId", "subscriptionName", "userId", "userName"],
    }),
    execute: async (params) => {
      const pending = createPendingAction(
        { action: "remove_user", ...params },
        `Remove ${params.userName} from the "${params.subscriptionName}" subscription.`,
        "Once unassigned, the user's access to the subscription is removed."
      );
      return { type: "pending_approval" as const, pendingAction: pending };
    },
  }),
};

// ==================== Execute after approval ====================

/**
 * SMP-203: execution through the service layer
 * - Removed the direct Server Action call + FormData workaround pattern
 * - Calls service functions directly for clean parameter passing
 *
 * Note: requireOrganization() is already called in the API route.
 * executeWriteTool is called from PUT /api/ai/write, so it receives ctx as an argument.
 */
export async function executeWriteTool(
  pending: WriteToolPendingAction,
  ctx?: { organizationId: string; userId: string; role: string }
): Promise<WriteToolResult> {
  const { params } = pending;

  // Without ctx, fall back to requireOrganization (backward compatibility)
  let serviceCtx = ctx;
  if (!serviceCtx) {
    const { requireOrganization } = await import("@/lib/auth/require-auth");
    const auth = await requireOrganization();
    serviceCtx = {
      organizationId: auth.organizationId,
      userId: auth.userId,
      role: auth.role,
    };
  }

  try {
    switch (params.action) {
      case "create_app": {
        const { createApp } = await import("@/services/app.service");
        const result = await createApp(serviceCtx, {
          name: params.name,
          category: params.category,
          customWebsite: params.customWebsite,
          notes: params.notes,
          tags: params.tags,
        });
        if (!result.success)
          throw new Error(result.message ?? "Failed to create the app.");
        return {
          success: true,
          message: `The app "${params.name}" has been registered.`,
          data: result.data,
        };
      }

      case "update_app": {
        const { updateApp } = await import("@/services/app.service");
        const result = await updateApp(serviceCtx, params.id, {
          name: params.name,
          category: params.category,
          customWebsite: params.customWebsite,
          notes: params.notes,
          tags: params.tags,
          status: params.status,
        });
        if (!result.success)
          throw new Error(result.message ?? "Failed to update the app.");
        return {
          success: true,
          message: `The app has been updated.`,
          data: result.data,
        };
      }

      case "delete_app": {
        const { deleteApp } = await import("@/services/app.service");
        const result = await deleteApp(serviceCtx, params.id);
        if (!result.success)
          throw new Error(result.message ?? "Failed to delete the app.");
        return {
          success: true,
          message: `The app "${params.name}" has been deleted.`,
        };
      }

      case "create_subscription": {
        const { createSubscription } =
          await import("@/services/subscription.service");
        const result = await createSubscription(serviceCtx, {
          appId: params.appId,
          billingCycle: params.billingCycle,
          billingType: params.billingType,
          amount: params.amount,
          currency: params.currency,
          startDate: params.startDate,
          endDate: params.endDate,
          totalLicenses: params.totalLicenses,
          autoRenewal: params.autoRenewal,
          notes: params.notes,
        });
        if (!result.success)
          throw new Error(
            result.message ?? "Failed to create the subscription."
          );
        return {
          success: true,
          message: `The subscription for "${params.appName}" has been registered.`,
          data: result.data,
        };
      }

      case "update_subscription": {
        const { updateSubscription } =
          await import("@/services/subscription.service");
        const result = await updateSubscription(serviceCtx, params.id, {
          billingCycle: params.billingCycle,
          billingType: params.billingType,
          amount: params.amount,
          currency: params.currency,
          totalLicenses: params.totalLicenses,
          status: params.status,
          autoRenewal: params.autoRenewal,
          notes: params.notes,
        });
        if (!result.success)
          throw new Error(
            result.message ?? "Failed to update the subscription."
          );
        return {
          success: true,
          message: `The subscription has been updated.`,
          data: result.data,
        };
      }

      case "delete_subscription": {
        const { deleteSubscription } =
          await import("@/services/subscription.service");
        const result = await deleteSubscription(serviceCtx, params.id);
        if (!result.success)
          throw new Error(
            result.message ?? "Failed to delete the subscription."
          );
        return {
          success: true,
          message: `The subscription for "${params.appName}" has been deleted.`,
        };
      }

      case "confirm_suggestion": {
        // confirm_suggestion still calls the Server Action (suggestion-specific logic)
        const {
          suggestSubscriptionsFromPayments,
          suggestFromCardTransactions,
          createSubscriptionFromPaymentSuggestion,
          createSubscriptionFromCardSuggestion,
        } = await import("@/actions/subscriptions/subscription-suggestions");

        if (params.suggestionSource === "payment_record") {
          const suggestResult = await suggestSubscriptionsFromPayments();
          if (!suggestResult.success || !suggestResult.data)
            throw new Error("Failed to load subscription suggestions.");
          const suggestion = suggestResult.data.find(
            (s) => s.appId === params.appId
          );
          if (!suggestion)
            throw new Error(
              `No payment-based suggestion found for "${params.appName}".`
            );

          const result = await createSubscriptionFromPaymentSuggestion({
            suggestion,
            selectedUserIds: params.selectedUserIds ?? [],
            billingType: params.billingType,
            totalLicenses: params.totalLicenses ?? null,
          });
          if (!result.success)
            throw new Error(
              result.message ?? "Failed to create the subscription."
            );
          return {
            success: true,
            message: `The subscription for "${params.appName}" has been registered from payment history.`,
            data: result.data,
          };
        } else {
          const suggestResult = await suggestFromCardTransactions();
          if (!suggestResult.success || !suggestResult.data)
            throw new Error("Failed to load card transaction suggestions.");
          const suggestion = suggestResult.data.find(
            (s) => s.appId === params.appId
          );
          if (!suggestion)
            throw new Error(
              `No card-based suggestion found for "${params.appName}".`
            );

          const result = await createSubscriptionFromCardSuggestion({
            suggestion,
            selectedUserIds: params.selectedUserIds ?? [],
            billingType: params.billingType,
            totalLicenses: params.totalLicenses ?? null,
          });
          if (!result.success)
            throw new Error(
              result.message ?? "Failed to create the subscription."
            );
          return {
            success: true,
            message: `The subscription for "${params.appName}" has been registered from card transactions.`,
            data: result.data,
          };
        }
      }

      case "assign_user": {
        const { assignUserToSubscription } =
          await import("@/actions/subscriptions/subscription-seat-management");
        const result = await assignUserToSubscription(
          params.subscriptionId,
          params.userId
        );
        if (!result.success)
          throw new Error(result.error ?? "Failed to assign the user.");
        return {
          success: true,
          message: `${params.userName} has been assigned to the "${params.subscriptionName}" subscription.`,
          data: result.data,
        };
      }

      case "remove_user": {
        const { removeUserFromSubscription } =
          await import("@/actions/subscriptions/subscription-seat-management");
        const result = await removeUserFromSubscription(
          params.subscriptionId,
          params.userId
        );
        if (!result.success)
          throw new Error(result.error ?? "Failed to remove the user.");
        return {
          success: true,
          message: `${params.userName} has been removed from the "${params.subscriptionName}" subscription.`,
        };
      }

      default:
        return { success: false, message: "Unknown action." };
    }
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "An error occurred while performing the action.",
    };
  }
}
