// src/types/approval.ts
/**
 * Shared types for the Approvals feature area (requests, policies, timeline).
 * Decimal columns are serialised to `number` before leaving the server.
 */
import type {
  ApprovalApproverType,
  ApprovalEventType,
  ApprovalRequestStatus,
  ApprovalStepStatus,
  BillingCycle,
  UserRole,
} from "@prisma/client";

export type ApprovalInboxTab = "to_review" | "mine" | "all";

export type ApprovalSortField =
  | "submittedAt"
  | "monthlyAmount"
  | "serviceName"
  | "status";

export interface ApprovalListFilters {
  tab?: ApprovalInboxTab;
  status?: ApprovalRequestStatus;
  requesterId?: string;
  categoryId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sortBy?: ApprovalSortField;
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface ApprovalUserRef {
  id: string;
  name: string | null;
  email: string;
  image?: string | null;
}

export interface ApprovalRequestListItem {
  id: string;
  serviceName: string;
  vendorWebsite: string | null;
  amount: number;
  currency: string;
  billingCycle: BillingCycle;
  monthlyAmount: number;
  seats: number | null;
  status: ApprovalRequestStatus;
  currentStep: number;
  totalSteps: number;
  submittedAt: string;
  decidedAt: string | null;
  requester: ApprovalUserRef;
  category: { id: string; name: string } | null;
  currentApprover: ApprovalUserRef | null;
  isAwaitingMe: boolean;
}

export interface ApprovalStepView {
  id: string;
  stepOrder: number;
  label: string;
  status: ApprovalStepStatus;
  comment: string | null;
  dueAt: string | null;
  decidedAt: string | null;
  approver: ApprovalUserRef;
  candidates: ApprovalUserRef[];
}

export interface ApprovalEventView {
  id: string;
  type: ApprovalEventType;
  comment: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: ApprovalUserRef | null;
}

export interface ApprovalRequestDetail extends ApprovalRequestListItem {
  justification: string;
  costCenter: { id: string; code: string; name: string } | null;
  policy: { id: string; name: string } | null;
  subscriptionId: string | null;
  catalog: { id: string; name: string; logoUrl: string | null } | null;
  steps: ApprovalStepView[];
  events: ApprovalEventView[];
  escalatedAt: string | null;
  lastReminderAt: string | null;
  viewer: {
    canDecide: boolean;
    canProvideInfo: boolean;
    canCancel: boolean;
    canComment: boolean;
    isRequester: boolean;
  };
}

export interface ApprovalPolicyStepView {
  id?: string;
  stepOrder: number;
  label: string;
  approverType: ApprovalApproverType;
  approverUserId: string | null;
  approverRole: UserRole | null;
  approverUser?: ApprovalUserRef | null;
}

export interface ApprovalPolicyView {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  priority: number;
  appliesToAll: boolean;
  costThreshold: number | null;
  costThresholdCurrency: string;
  categoryIds: string[];
  reminderAfterDays: number | null;
  escalationAfterDays: number | null;
  steps: ApprovalPolicyStepView[];
  requestCount: number;
}

export interface PendingApprovalsSummary {
  count: number;
  committedMonthly: number;
  currency: string;
  items: ApprovalRequestListItem[];
}

export interface ApprovalCycleOption {
  cycle: BillingCycle;
  label: string;
  months: number;
}

export interface ApprovalCategoryOption {
  id: string;
  name: string;
  parentId: string | null;
  color: string | null;
  icon: string | null;
}

export interface ApprovalFormOptions {
  currencies: string[];
  defaultCurrency: string;
  cycles: ApprovalCycleOption[];
  categories: ApprovalCategoryOption[];
  costCenters: { id: string; code: string; name: string }[];
  justificationMinLength: number;
}

export interface CatalogSuggestion {
  id: string;
  name: string;
  website: string | null;
  logoUrl: string | null;
  category: string;
}

export interface PolicyFormOptions {
  users: ApprovalUserRef[];
  categories: ApprovalCategoryOption[];
  currencies: string[];
  defaultCurrency: string;
  roles: UserRole[];
  defaultReminderAfterDays: number;
  defaultEscalationAfterDays: number;
}

/** Shape stored in `ApprovalRequest.metadata`. */
export interface ApprovalRequestMetadata {
  /** Candidate approver ids per step order (ROLE steps may have several). */
  stepCandidates?: Record<string, string[]>;
  /** Candidates of the current step — used by inbox queries. */
  candidateIds?: string[];
  autoApproved?: boolean;
  escalatedTo?: string[];
  expired?: boolean;
  [key: string]: unknown;
}
