// src/actions/subscriptions/subscription-crud.types.ts
/**
 * Subscription CRUD 관련 타입 및 스키마 정의
 */

import { DEFAULT_BASE_CURRENCY } from "@/lib/fx/convert";
import type {
  SubscriptionFilterOptions,
  SubscriptionSortOptions,
} from "@/types/subscription";
import { BillingCycle, BillingType, SubscriptionStatus } from "@prisma/client";
import { z } from "zod";

/**
 * 구독 목록 조회 파라미터
 */
export interface GetSubscriptionsParams {
  filter?: SubscriptionFilterOptions;
  sort?: SubscriptionSortOptions;
  page?: number;
  limit?: number;
}

/**
 * 연결된 결제 정보
 */
export interface LinkedPayment {
  id: string;
  transactionDate: Date;
  merchantName: string;
  amount: number;
  currency: string;
  cardLast4: string | null;
}

const optionalDate = z.string().nullish().or(z.literal(""));
const optionalId = z.string().min(1).nullish().or(z.literal(""));
const MAX_NOTES = 1000;
const MAX_NOTICE_DAYS = 365;
const MAX_LEAD_DAYS = 365;

/**
 * 구독 생성 스키마 — either an existing `appId` or a vendor `appName`
 * (find-or-create) must be supplied.
 */
export const createSubscriptionSchema = z
  .object({
    appId: z.string().nullish().or(z.literal("")),
    appName: z.string().trim().max(200).nullish().or(z.literal("")),
    catalogId: optionalId,
    appWebsite: z.string().trim().max(500).nullish().or(z.literal("")),
    appLogoUrl: z.string().trim().max(1000).nullish().or(z.literal("")),
    billingCycle: z.nativeEnum(BillingCycle, {
      errorMap: () => ({ message: "결제 주기를 선택해주세요" }),
    }),
    billingType: z.nativeEnum(BillingType).default(BillingType.FLAT_RATE),
    amount: z
      .string()
      .min(1, "금액을 입력해주세요")
      .regex(/^\d+(\.\d{1,2})?$/, "유효한 금액을 입력해주세요"),
    currency: z.string().min(3).max(3).default(DEFAULT_BASE_CURRENCY),
    totalLicenses: z.coerce.number().int().positive().nullish(),
    usedLicenses: z.coerce.number().int().min(0).nullish(),
    startDate: z.string().min(1, "시작일을 입력해주세요"),
    endDate: optionalDate,
    renewalDate: optionalDate,
    autoRenewal: z.coerce.boolean().default(true),
    renewalAlert30: z.coerce.boolean().default(true),
    renewalAlert60: z.coerce.boolean().default(false),
    renewalAlert90: z.coerce.boolean().default(false),
    contractUrl: z
      .string()
      .url("유효한 URL을 입력하세요")
      .nullish()
      .or(z.literal("")),
    notes: z.string().max(MAX_NOTES, "메모는 1000자 이하여야 합니다").nullish(),
    // Team/User 배정 (Phase 2)
    teamId: z.string().nullish(),
    // Team 배정 (다중, Phase 3)
    teamIds: z.array(z.string()).default([]),
    assignedUserIds: z.array(z.string()).default([]),
    // SubHub taxonomy / finance dimensions
    categoryId: optionalId,
    paymentMethodId: optionalId,
    costCenterId: optionalId,
    taxRateId: optionalId,
    // Trial
    isTrial: z.coerce.boolean().default(false),
    trialEndsAt: optionalDate,
    // Contract terms
    noticePeriodDays: z.coerce
      .number()
      .int()
      .min(0)
      .max(MAX_NOTICE_DAYS)
      .nullish(),
    reminderLeadDays: z
      .array(z.coerce.number().int().min(0).max(MAX_LEAD_DAYS))
      .nullish(),
    // Personal mode & ownership
    isPersonal: z.coerce.boolean().default(false),
    ownerId: optionalId,
    // Tags / custom fields
    tagNames: z.array(z.string().trim().min(1).max(60)).default([]),
    customFields: z.record(z.string(), z.string()).default({}),
    // Cancellation overrides
    cancellationUrl: z
      .string()
      .url("유효한 URL을 입력하세요")
      .nullish()
      .or(z.literal("")),
    cancellationNotes: z.string().max(2000).nullish(),
  })
  .refine((data) => Boolean(data.appId) || Boolean(data.appName?.trim()), {
    message: "앱을 선택하거나 서비스명을 입력해주세요",
    path: ["appId"],
  });

export type CreateSubscriptionData = z.infer<typeof createSubscriptionSchema>;

/**
 * 구독 수정 스키마
 */
export const updateSubscriptionSchema = createSubscriptionSchema
  .innerType()
  .extend({
    status: z.nativeEnum(SubscriptionStatus).nullish(),
  });

export type UpdateSubscriptionData = z.infer<typeof updateSubscriptionSchema>;

/**
 * Next.js redirect 에러 체크 유틸리티
 */
export function isRedirectError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    ((error as { digest: string }).digest.includes("NEXT_REDIRECT") ||
      (error as { digest: string }).digest.includes("NEXT_NOT_FOUND"))
  );
}
