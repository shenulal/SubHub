// src/types/subscription.ts
import type { CustomFieldTypeValue } from "@/types/taxonomy";
import type {
  BillingCycle,
  BillingType,
  SubscriptionStatus,
} from "@prisma/client";

// Assigned user info
export interface AssignedUser {
  id: string;
  name: string | null;
  email: string;
}

export interface SubscriptionCategoryRef {
  id: string;
  name: string;
  parentName: string | null;
  color: string | null;
}

export interface SubscriptionTagRef {
  id: string;
  name: string;
  color: string | null;
}

export interface SubscriptionOwnerRef {
  id: string;
  name: string | null;
  email: string;
}

export interface SubscriptionPaymentMethodRef {
  id: string;
  name: string;
}

export interface SubscriptionCostCenterRef {
  id: string;
  code: string;
  name: string;
}

export interface SubscriptionCustomFieldValue {
  fieldId: string;
  key: string;
  label: string;
  /** Field type; MULTI_SELECT values are JSON array strings. */
  fieldType?: CustomFieldTypeValue;
  value: string;
}

export interface SubscriptionListItem {
  id: string;
  appId: string;
  appName: string;
  appLogoUrl: string | null;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  billingType: BillingType;
  amount: number;
  perSeatPrice: number | null;
  currency: string;
  totalLicenses: number | null;
  usedLicenses: number | null;
  startDate: Date;
  endDate: Date | null;
  renewalDate: Date | null;
  autoRenewal: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Team assignment (single, deprecated - backward compat)
  teamId: string | null;
  teamName: string | null;
  // Team assignment (multiple)
  teams: Array<{ id: string; name: string }>;
  // User assignment (multiple)
  assignedUsers: AssignedUser[];
  // SubHub lifecycle & taxonomy
  category: SubscriptionCategoryRef | null;
  tags: SubscriptionTagRef[];
  owner: SubscriptionOwnerRef | null;
  isPersonal: boolean;
  isTrial: boolean;
  trialEndsAt: Date | null;
  cancellationDeadline: Date | null;
  /** Monthly-normalised amount in the organisation base currency (when FX is available). */
  monthlyAmountBase?: number;
  paymentMethod: SubscriptionPaymentMethodRef | null;
  costCenter: SubscriptionCostCenterRef | null;
}

export interface SubscriptionDetail extends SubscriptionListItem {
  contractUrl: string | null;
  notes: string | null;
  renewalAlert30: boolean;
  renewalAlert60: boolean;
  renewalAlert90: boolean;
  // Details include the Team object (single, deprecated - backward compat)
  team: { id: string; name: string } | null;
  // SubHub lifecycle fields
  noticePeriodDays: number | null;
  reminderLeadDays: number[];
  pausedAt: Date | null;
  archivedAt: Date | null;
  lastDetectedAmount: number | null;
  cancellationUrl: string | null;
  cancellationNotes: string | null;
  taxRate: { id: string; name: string; ratePercent: number } | null;
  customFieldValues: SubscriptionCustomFieldValue[];
  app: {
    catalogId: string | null;
    website: string | null;
    cancellationUrl: string | null;
    cancellationNotes: string | null;
  };
}

export interface CreateSubscriptionInput {
  appId?: string;
  appName?: string;
  catalogId?: string;
  status?: SubscriptionStatus;
  billingCycle: BillingCycle;
  billingType?: BillingType;
  amount: string;
  perSeatPrice?: string;
  currency?: string;
  totalLicenses?: number;
  usedLicenses?: number;
  startDate: string;
  endDate?: string;
  renewalDate?: string;
  autoRenewal?: boolean;
  renewalAlert30?: boolean;
  renewalAlert60?: boolean;
  renewalAlert90?: boolean;
  contractUrl?: string;
  notes?: string;
  // Team/User assignment
  teamId?: string;
  teamIds?: string[];
  assignedUserIds?: string[];
  // SubHub
  categoryId?: string | null;
  paymentMethodId?: string | null;
  costCenterId?: string | null;
  taxRateId?: string | null;
  isTrial?: boolean;
  trialEndsAt?: string | null;
  noticePeriodDays?: number | null;
  reminderLeadDays?: number[];
  isPersonal?: boolean;
  ownerId?: string | null;
  tagNames?: string[];
  customFields?: Record<string, string>;
  cancellationUrl?: string | null;
  cancellationNotes?: string | null;
}

export type UpdateSubscriptionInput = Partial<CreateSubscriptionInput>;

export type SubscriptionScope = "personal" | "workspace" | "all";

export interface SubscriptionFilterOptions {
  status?: SubscriptionStatus;
  statuses?: SubscriptionStatus[];
  appId?: string;
  billingCycle?: BillingCycle;
  search?: string;
  renewingWithinDays?: number;
  categoryId?: string;
  parentCategoryId?: string;
  tagIds?: string[];
  ownerId?: string;
  teamId?: string;
  costCenterId?: string;
  paymentMethodId?: string;
  /**
   * Multi-value variants (REST `?ownerId=a,b`). Combined with the single
   * value above when both are given; empty = no filter.
   */
  billingCycles?: BillingCycle[];
  categoryIds?: string[];
  parentCategoryIds?: string[];
  ownerIds?: string[];
  teamIds?: string[];
  costCenterIds?: string[];
  paymentMethodIds?: string[];
  /** Monthly-normalised amount bounds in base currency (falls back to raw amount). */
  amountMin?: number;
  amountMax?: number;
  scope?: SubscriptionScope;
  /** Archived subscriptions are hidden unless explicitly requested. */
  includeArchived?: boolean;
}

export type SubscriptionSortBy =
  | "renewalDate"
  | "amount"
  | "createdAt"
  | "appName"
  | "status"
  | "category"
  | "owner";

export interface SubscriptionSortOptions {
  sortBy?: SubscriptionSortBy;
  sortOrder?: "asc" | "desc";
}

// P2: Seat management detail types
export interface SeatUser {
  id: string;
  name: string | null;
  email: string;
  assignedAt: Date;
  assignedBy: string | null;
  lastUsedAt: Date | null;
  isInactive: boolean; // lastUsedAt > 30 days or null
}

export interface SeatDetails {
  assignedUsers: SeatUser[];
  totalSeats: number;
  usedSeats: number;
  unassignedSeats: number;
  inactiveSeats: number; // assigned but unused for 30+ days
}
