/**
 * SubHub AI Agent Read Tool
 * SMP-197: wraps Server Actions as Tools so the AI can query DB data in natural language
 * SMP-203: Read Tool cleanup — section grouping + RT numbering
 *
 * Read Tools run automatically without user approval.
 * The inputSchema key is required (AI SDK v6 — do not use parameters)
 *
 * Composition (18 tools):
 *  - App management: search_apps, get_app_detail, get_dashboard_stats (3)
 *  - Subscription management: search_subscriptions, get_upcoming_renewals, get_renewal_alerts, get_subscription_suggestions (4)
 *  - Cost analytics: get_monthly_cost_trend, detect_cost_anomalies, get_forecasted_cost, get_spend_by_category, get_top_spending_apps (5)
 *  - Users/security: get_users, get_security_insights, get_unused_apps, get_seat_optimization, get_teams, get_audit_logs (6)
 */

import { jsonSchema, tool } from "ai";

// ─── App management (3) ───

const search_apps = tool({
  description:
    "Searches apps by name. When the user mentions an app name, use this tool to find its ID.",
  inputSchema: jsonSchema<{
    query?: string;
    status?: string;
    category?: string;
    limit?: number;
  }>({
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "App name to search for (e.g. Figma, Slack, Notion)",
      },
      status: {
        type: "string",
        description: "App status filter (ACTIVE, INACTIVE, etc.)",
      },
      category: { type: "string", description: "Category filter" },
      limit: { type: "number", description: "Number of results (default 10)" },
    },
    required: [],
  }),
  execute: async ({ query, status, category, limit }) => {
    const { getApps } = await import("@/actions/apps");
    const result = await getApps({
      filter: {
        ...(query && { search: query }),
        ...(status && { status: status as "ACTIVE" | "INACTIVE" }),
        ...(category && { category }),
      },
      page: 1,
      limit: limit ?? 10,
    });
    return {
      apps: result.items.map((app) => ({
        id: app.id,
        name: app.name,
        status: app.status,
        category: app.category ?? null,
        subscriptionCount: app.subscriptionCount,
      })),
      total: result.total,
    };
  },
});

const get_app_detail = tool({
  description:
    "Gets app details by app ID. Use when details such as subscriptions, user count or cost are needed.",
  inputSchema: jsonSchema<{ id: string }>({
    type: "object",
    properties: {
      id: { type: "string", description: "App ID" },
    },
    required: ["id"],
  }),
  execute: async ({ id }) => {
    const { getApp } = await import("@/actions/apps");
    const app = await getApp(id);
    if (!app) return { error: "App not found." };
    return { app };
  },
});

const get_dashboard_stats = tool({
  description:
    "Gets dashboard statistics: total apps, active apps, subscription count, etc.",
  inputSchema: jsonSchema<Record<string, never>>({
    type: "object",
    properties: {},
    required: [],
  }),
  execute: async () => {
    const { getDashboardStats } = await import("@/actions/dashboard");
    return await getDashboardStats();
  },
});

// ─── Subscription management (4) ───

const search_subscriptions = tool({
  description:
    "Lists subscriptions. Can be filtered by app ID, status or name.",
  inputSchema: jsonSchema<{
    appId?: string;
    status?: string;
    search?: string;
    limit?: number;
  }>({
    type: "object",
    properties: {
      appId: { type: "string", description: "Filter by app ID" },
      status: { type: "string", description: "Subscription status filter" },
      search: { type: "string", description: "Search by app name" },
      limit: { type: "number", description: "Number of results (default 10)" },
    },
    required: [],
  }),
  execute: async ({ appId, status, search, limit }) => {
    const { getSubscriptions } =
      await import("@/actions/subscriptions/subscription-crud-read");
    const result = await getSubscriptions({
      filter: {
        ...(appId && { appId }),
        ...(status && {
          status: status as "ACTIVE" | "EXPIRED" | "CANCELLED" | "PENDING",
        }),
        ...(search && { search }),
      },
      page: 1,
      limit: limit ?? 10,
    });
    return { subscriptions: result.items, total: result.total };
  },
});

const get_upcoming_renewals = tool({
  description:
    "Lists upcoming renewals. Use to check subscriptions renewing soon.",
  inputSchema: jsonSchema<Record<string, never>>({
    type: "object",
    properties: {},
    required: [],
  }),
  execute: async () => {
    const { getUrgentRenewals } = await import("@/actions/dashboard2-renewals");
    return await getUrgentRenewals();
  },
});

const get_renewal_alerts = tool({
  description: "Lists renewal alerts.",
  inputSchema: jsonSchema<{ sentOnly?: boolean }>({
    type: "object",
    properties: {
      sentOnly: {
        type: "boolean",
        description: "Only alerts that have been sent",
      },
    },
    required: [],
  }),
  execute: async ({ sentOnly }) => {
    const { getRenewalAlerts } = await import("@/actions/renewal-alerts");
    return await getRenewalAlerts({ sentOnly });
  },
});

// ─── Cost analytics (5) ───

const get_monthly_cost_trend = tool({
  description: "Gets the monthly cost trend.",
  inputSchema: jsonSchema<{ months?: number }>({
    type: "object",
    properties: {
      months: {
        type: "number",
        description: "Trend period in months (default 6)",
      },
    },
    required: [],
  }),
  execute: async ({ months }) => {
    const { getMonthlyCostTrend } =
      await import("@/actions/cost-analytics-trend");
    return await getMonthlyCostTrend({ months: months ?? 6 });
  },
});

const detect_cost_anomalies = tool({
  description:
    "Detects cost anomalies: finds apps with higher-than-usual spend.",
  inputSchema: jsonSchema<Record<string, never>>({
    type: "object",
    properties: {},
    required: [],
  }),
  execute: async () => {
    const { getCostAnomalies } =
      await import("@/actions/cost-analytics-forecast");
    return await getCostAnomalies();
  },
});

const get_forecasted_cost = tool({
  description: "Cost forecast: calculates the expected cost for a given month.",
  inputSchema: jsonSchema<{ targetMonth?: string }>({
    type: "object",
    properties: {
      targetMonth: {
        type: "string",
        description: "Target month (YYYY-MM format, default next month)",
      },
    },
    required: [],
  }),
  execute: async ({ targetMonth }) => {
    const { getForecastedCost } =
      await import("@/actions/cost-analytics-forecast");
    return await getForecastedCost({ targetMonth });
  },
});

const get_spend_by_category = tool({
  description: "Gets spend by category.",
  inputSchema: jsonSchema<Record<string, never>>({
    type: "object",
    properties: {},
    required: [],
  }),
  execute: async () => {
    const { getSpendByCategory } = await import("@/actions/dashboard2-cost");
    return await getSpendByCategory();
  },
});

const get_top_spending_apps = tool({
  description: "Gets the top-spending apps.",
  inputSchema: jsonSchema<{ limit?: number }>({
    type: "object",
    properties: {
      limit: { type: "number", description: "Top N (default 10)" },
    },
    required: [],
  }),
  execute: async ({ limit }) => {
    const { getTopSpendingApps } = await import("@/actions/dashboard2-cost");
    return await getTopSpendingApps(limit ?? 10);
  },
});

// ─── Users/security (6) ───

const get_users = tool({
  description: "Lists users.",
  inputSchema: jsonSchema<{ search?: string; limit?: number }>({
    type: "object",
    properties: {
      search: { type: "string", description: "Search by name/email" },
      limit: { type: "number", description: "Number of results (default 20)" },
    },
    required: [],
  }),
  execute: async ({ search, limit }) => {
    const { getUsers } = await import("@/actions/users-read");
    return await getUsers({
      filter: search ? { search } : {},
      page: 1,
      limit: limit ?? 20,
    });
  },
});

const get_security_insights = tool({
  description: "Gets security insights: security score, risk factors, etc.",
  inputSchema: jsonSchema<Record<string, never>>({
    type: "object",
    properties: {},
    required: [],
  }),
  execute: async () => {
    const { getSecurityInsights } = await import("@/actions/security-insights");
    return await getSecurityInsights();
  },
});

const get_unused_apps = tool({
  description:
    "Lists unused apps. Useful for finding cost-saving opportunities.",
  inputSchema: jsonSchema<Record<string, never>>({
    type: "object",
    properties: {},
    required: [],
  }),
  execute: async () => {
    const { getUnusedApps } = await import("@/actions/unused-apps");
    return await getUnusedApps();
  },
});

const get_seat_optimization = tool({
  description:
    "Gets seat optimization suggestions: reduce unused licenses to cut costs.",
  inputSchema: jsonSchema<Record<string, never>>({
    type: "object",
    properties: {},
    required: [],
  }),
  execute: async () => {
    const { getSeatOptimizationSuggestions } =
      await import("@/actions/seat-optimization");
    return await getSeatOptimizationSuggestions();
  },
});

const get_teams = tool({
  description: "Lists teams.",
  inputSchema: jsonSchema<Record<string, never>>({
    type: "object",
    properties: {},
    required: [],
  }),
  execute: async () => {
    const { getTeams } = await import("@/actions/teams");
    return await getTeams();
  },
});

const get_audit_logs = tool({
  description: "Gets audit logs: who did what and when.",
  inputSchema: jsonSchema<{
    action?: string;
    userId?: string;
    limit?: number;
  }>({
    type: "object",
    properties: {
      action: { type: "string", description: "Action type filter" },
      userId: { type: "string", description: "User ID filter" },
      limit: { type: "number", description: "Number of results (default 20)" },
    },
    required: [],
  }),
  execute: async ({ action, userId, limit }) => {
    const { getAuditLogs } = await import("@/actions/audit");
    return await getAuditLogs({
      action,
      userId,
      page: 1,
      limit: limit ?? 20,
    });
  },
});

// ─── Subscription suggestions (part of subscription management) ───

const get_subscription_suggestions = tool({
  description:
    "Lists subscription suggestions based on payment history. Returns per-app suggestions detected from payment patterns (amount, billing cycle, per-seat vs flat fee, assignable users). When the user says things like 'register a subscription' or 'check suggestions', call this tool first.",
  inputSchema: jsonSchema<{ appName?: string }>({
    type: "object",
    properties: {
      appName: {
        type: "string",
        description:
          "Filter to a specific app (e.g. Datadog). Omit to return all suggestions",
      },
    },
    required: [],
  }),
  execute: async ({ appName }) => {
    const { suggestSubscriptionsFromPayments, suggestFromCardTransactions } =
      await import("@/actions/subscriptions/subscription-suggestions");

    const [paymentResult, cardResult] = await Promise.all([
      suggestSubscriptionsFromPayments(),
      suggestFromCardTransactions(),
    ]);

    const allSuggestions = [
      ...(paymentResult.success && paymentResult.data
        ? paymentResult.data.map((s) => ({
            ...s,
            source: "payment_record" as const,
          }))
        : []),
      ...(cardResult.success && cardResult.data
        ? cardResult.data.map((s) => ({
            ...s,
            source: "card_transaction" as const,
          }))
        : []),
    ];

    // App name filter
    const filtered = appName
      ? allSuggestions.filter((s) =>
          s.appName.toLowerCase().includes(appName.toLowerCase())
        )
      : allSuggestions;

    return {
      suggestions: filtered.map((s) => ({
        appId: s.appId,
        appName: s.appName,
        source: s.source,
        suggestedAction: s.suggestedAction,
        suggestedAmount: s.suggestedAmount,
        suggestedBillingCycle: s.suggestedBillingCycle,
        currency: s.currency,
        billingType: s.billingType,
        perSeatPrice: s.perSeatPrice,
        suggestedSeats: s.suggestedSeats,
        seatDetectionMethod: s.seatDetectionMethod ?? null,
        seatDetectionConfidence: s.seatDetectionConfidence ?? null,
        confidence: s.confidence,
        paymentCount: s.paymentCount,
        firstPaymentDate: s.firstPaymentDate,
        lastPaymentDate: s.lastPaymentDate,
        teamId: s.teamId,
        teamName: s.teamName,
        availableUsers: s.availableUsers.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          teamName: u.teamName,
        })),
      })),
      total: filtered.length,
    };
  },
});

// ─── Export ───

export const readTools = {
  // App management (3)
  search_apps,
  get_app_detail,
  get_dashboard_stats,
  // Subscription management + suggestions (4)
  search_subscriptions,
  get_upcoming_renewals,
  get_renewal_alerts,
  get_subscription_suggestions,
  // Cost analytics (5)
  get_monthly_cost_trend,
  detect_cost_anomalies,
  get_forecasted_cost,
  get_spend_by_category,
  get_top_spending_apps,
  // Users/security (6)
  get_users,
  get_security_insights,
  get_unused_apps,
  get_seat_optimization,
  get_teams,
  get_audit_logs,
};
