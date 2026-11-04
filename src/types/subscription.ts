// src/types/subscription.ts
import type {
  BillingCycle,
  BillingType,
  SubscriptionStatus,
} from "@prisma/client";

// 배정된 사용자 정보
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
  // Team 배정 (단일, deprecated - backward compat)
  teamId: string | null;
  teamName: string | null;
  // Team 배정 (다중)
  teams: Array<{ id: string; name: string }>;
  // User 배정 (다중)
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
  // 상세 정보에 Team 객체 포함 (단일, deprecated - backward compat)
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
  // Team/User 배정
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

// P2: Seat 관리 상세 타입
export interface SeatUser {
  id: string;
  name: string | null;
  email: string;
  assignedAt: Date;
  assignedBy: string | null;
  lastUsedAt: Date | null;
  isInactive: boolean; // lastUsedAt > 30일 또는 null
}

export interface SeatDetails {
  assignedUsers: SeatUser[];
  totalSeats: number;
  usedSeats: number;
  unassignedSeats: number;
  inactiveSeats: number; // 할당됐지만 30일+ 미사용
}
