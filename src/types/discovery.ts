// src/types/discovery.ts
/**
 * Discovery, dashboard and daily-usability types (search, filters, saved views,
 * renewal pipeline, workspace scope, dashboard overview).
 */
import type { SubscriptionListItem } from "@/types/subscription";
import type { BillingCycle, SubscriptionStatus } from "@prisma/client";

// ─── Workspace scope (6.4) ───────────────────────────────────────

export const WORKSPACE_SCOPES = ["workspace", "personal", "all"] as const;
export type WorkspaceScope = (typeof WORKSPACE_SCOPES)[number];

export interface WorkspaceScopeState {
  scope: WorkspaceScope;
  allowPersonal: boolean;
}

// ─── Subscription list filters & sort (9.2 / 9.3) ─────────────────

export const SUBSCRIPTION_SORT_FIELDS = [
  "renewalDate",
  "amount",
  "appName",
  "status",
  "category",
  "owner",
  "createdAt",
] as const;
export type SubscriptionSortField = (typeof SUBSCRIPTION_SORT_FIELDS)[number];
export type SortOrder = "asc" | "desc";

export interface SubscriptionListFilter {
  search?: string;
  /**
   * Category ids; a parent category also matches its subcategories.
   * Replaces the legacy single `categoryId` / `parentCategoryId` (still read
   * from old URLs and saved views, see `normalizeLegacySubscriptionFilter`).
   */
  categoryIds?: string[];
  tagIds?: string[];
  statuses?: SubscriptionStatus[];
  includeArchived?: boolean;
  /** Multi-value facets: empty / missing = no filter. */
  ownerIds?: string[];
  teamIds?: string[];
  costCenterIds?: string[];
  paymentMethodIds?: string[];
  billingCycles?: BillingCycle[];
  amountMin?: number;
  amountMax?: number;
  renewingWithinDays?: number;
  trialOnly?: boolean;
  scope?: WorkspaceScope;
}

export interface SubscriptionListSort {
  sortBy: SubscriptionSortField;
  sortOrder: SortOrder;
}

export interface SubscriptionListQuery {
  filter: SubscriptionListFilter;
  sort: SubscriptionListSort;
  page: number;
  limit: number;
}

/** Reference data for the filter bar (ids + labels only). */
export interface NamedOption {
  id: string;
  name: string;
  color?: string | null;
}

export interface CategoryOption extends NamedOption {
  parentId: string | null;
  children?: CategoryOption[];
}

export interface SubscriptionFilterOptions {
  categories: CategoryOption[];
  tags: NamedOption[];
  owners: NamedOption[];
  teams: NamedOption[];
  costCenters: NamedOption[];
  paymentMethods: NamedOption[];
}

/** List row shape (the Lifecycle agent's extended `SubscriptionListItem`). */
export type DiscoverySubscriptionItem = SubscriptionListItem;

// ─── Saved views (9.2) ───────────────────────────────────────────

export interface SavedViewDto {
  id: string;
  entity: string;
  name: string;
  filters: SubscriptionListFilter;
  sort: SubscriptionListSort | null;
  isShared: boolean;
  isOwner: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Global search (9.1) ─────────────────────────────────────────

export const SEARCH_GROUPS = [
  "subscriptions",
  "approvals",
  "vendors",
  "people",
  "pages",
  "actions",
] as const;
export type SearchGroupKey = (typeof SEARCH_GROUPS)[number];

export interface SearchResultItem {
  id: string;
  group: SearchGroupKey;
  title: string;
  subtitle?: string;
  href: string;
  imageUrl?: string | null;
  /** i18n key for static pages/actions; title is the fallback */
  labelKey?: string;
  permission?: string;
}

export interface SearchResultGroup {
  key: SearchGroupKey;
  items: SearchResultItem[];
}

export interface GlobalSearchResult {
  query: string;
  groups: SearchResultGroup[];
  meta: { limit: number; minChars: number; recentSearchesLimit: number };
}

// ─── Renewal pipeline (9.5) ──────────────────────────────────────

export const PIPELINE_LANES = [
  "overdue",
  "week",
  "month",
  "later",
  "trialEnding",
  "noticeDeadline",
] as const;
export type PipelineLaneKey = (typeof PIPELINE_LANES)[number];

export interface PipelineCard {
  id: string;
  appId: string;
  appName: string;
  appLogoUrl: string | null;
  amount: number;
  currency: string;
  monthlyBase: number;
  annualBase: number;
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
  /** Date driving the lane (renewal, trial end or cancellation deadline) — ISO */
  dueDate: string;
  daysLeft: number;
  owner: { id: string; name: string | null } | null;
  teamName: string | null;
  isTrial: boolean;
  isPersonal: boolean;
}

export interface PipelineLane {
  key: PipelineLaneKey;
  count: number;
  monthlyBase: number;
  annualBase: number;
  cards: PipelineCard[];
}

export interface RenewalPipelineData {
  baseCurrency: string;
  generatedAt: string;
  weekDays: number;
  monthDays: number;
  hasStaleRates: boolean;
  lanes: PipelineLane[];
}

// ─── Calendar extras (9.4) ───────────────────────────────────────

export type CalendarMarkerKind = "trialEnd" | "cancellationDeadline";

export interface CalendarMarker {
  kind: CalendarMarkerKind;
  subscriptionId: string;
  appName: string;
  appLogoUrl: string | null;
  date: string; // YYYY-MM-DD
  amount: number;
  currency: string;
}

// ─── Dashboard overview (4.1 / 4.2 / 4.4) ────────────────────────

export interface DashboardKpis {
  monthlySpendBase: number;
  annualRunRateBase: number;
  activeCount: number;
  renewingSoonCount: number;
  renewingSoonDays: number;
  pendingApprovalsCount: number;
  pendingApprovalsMonthlyBase: number;
}

export interface DashboardRenewalRow {
  id: string;
  appName: string;
  appLogoUrl: string | null;
  renewalDate: string;
  daysUntilRenewal: number;
  amountBase: number;
  isTrial: boolean;
}

export interface CategorySpendSlice {
  categoryId: string | null;
  name: string;
  color: string | null;
  parentId: string | null;
  monthlyBase: number;
  count: number;
  children?: CategorySpendSlice[];
}

export interface DashboardOverview {
  scope: WorkspaceScope;
  baseCurrency: string;
  hasStaleRates: boolean;
  generatedAt: string;
  kpis: DashboardKpis;
  upcomingRenewals: DashboardRenewalRow[];
  categorySpend: CategorySpendSlice[];
}
