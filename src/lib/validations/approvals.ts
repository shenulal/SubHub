// src/lib/validations/approvals.ts
/**
 * Zod schemas for the Approvals feature area. Tunables (minimum justification
 * length, allowed currencies) are injected by the caller from the settings
 * registry so nothing is hard-coded here.
 */
import { z } from "zod";

const CUID = z.string().min(1).max(64);
const OPTIONAL_ID = z
  .union([CUID, z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

/**
 * Optional numeric form field: "", null and undefined mean "not set" (null).
 * Preprocessing runs before coercion so a blank input never becomes 0.
 */
function optionalNumber(inner: z.ZodType<number, unknown>) {
  return z.preprocess(
    (value) => (value === "" || value === undefined ? null : value),
    inner.nullable()
  );
}

export const BILLING_CYCLES = [
  "MONTHLY",
  "QUARTERLY",
  "YEARLY",
  "ONE_TIME",
] as const;

export const APPROVAL_STATUSES = [
  "PENDING",
  "INFO_REQUESTED",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
] as const;

export const APPROVER_TYPES = [
  "USER",
  "MANAGER",
  "TEAM_APPROVER",
  "ROLE",
] as const;

export const APPROVER_ROLES = ["ADMIN", "APPROVER", "MEMBER"] as const;

export interface RequestSchemaOptions {
  justificationMinLength: number;
  currencies: readonly string[];
}

export function buildCreateApprovalRequestSchema(opts: RequestSchemaOptions) {
  const currencies = opts.currencies.length ? opts.currencies : ["USD"];
  return z.object({
    serviceName: z.string().trim().min(1).max(120),
    catalogId: OPTIONAL_ID,
    vendorWebsite: z
      .union([z.string().trim().url().max(500), z.literal(""), z.null()])
      .optional()
      .transform((v) => (v ? v : null)),
    amount: z.coerce.number().positive().max(999_999_999),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .refine((c) => currencies.includes(c), {
        message: "Unsupported currency",
      }),
    billingCycle: z.enum(BILLING_CYCLES),
    seats: optionalNumber(z.coerce.number().int().min(1).max(100_000)),
    categoryId: OPTIONAL_ID,
    costCenterId: OPTIONAL_ID,
    justification: z.string().trim().min(opts.justificationMinLength).max(4000),
  });
}

export type CreateApprovalRequestInput = z.infer<
  ReturnType<typeof buildCreateApprovalRequestSchema>
>;

export const decisionCommentSchema = z.object({
  requestId: CUID,
  comment: z.string().trim().max(2000).optional().nullable(),
});

export const requiredCommentSchema = z.object({
  requestId: CUID,
  comment: z.string().trim().min(1).max(2000),
});

export const approvalDecisionActionSchema = z.enum([
  "approve",
  "reject",
  "request_info",
  "provide_info",
  "cancel",
]);

export const approvalListFiltersSchema = z.object({
  tab: z.enum(["to_review", "mine", "all"]).default("to_review"),
  status: z.enum(APPROVAL_STATUSES).optional(),
  requesterId: CUID.optional(),
  categoryId: CUID.optional(),
  dateFrom: z
    .string()
    .datetime({ offset: true })
    .or(z.string().date())
    .optional(),
  dateTo: z
    .string()
    .datetime({ offset: true })
    .or(z.string().date())
    .optional(),
  search: z.string().trim().max(120).optional(),
  sortBy: z
    .enum(["submittedAt", "monthlyAmount", "serviceName", "status"])
    .default("submittedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ApprovalListFiltersInput = z.input<
  typeof approvalListFiltersSchema
>;

export const policyStepSchema = z
  .object({
    id: CUID.optional(),
    label: z.string().trim().min(1).max(80),
    approverType: z.enum(APPROVER_TYPES),
    approverUserId: OPTIONAL_ID,
    approverRole: z.enum(APPROVER_ROLES).nullable().optional(),
  })
  .superRefine((step, ctx) => {
    if (step.approverType === "USER" && !step.approverUserId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["approverUserId"],
        message: "Select an approver",
      });
    }
    if (step.approverType === "ROLE" && !step.approverRole) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["approverRole"],
        message: "Select a role",
      });
    }
  });

export const upsertPolicySchema = z
  .object({
    id: CUID.optional(),
    name: z.string().trim().min(1).max(100),
    description: z
      .string()
      .trim()
      .max(500)
      .optional()
      .nullable()
      .transform((v) => (v ? v : null)),
    isActive: z.boolean().default(true),
    appliesToAll: z.boolean().default(false),
    costThreshold: optionalNumber(z.coerce.number().min(0).max(999_999_999)),
    costThresholdCurrency: z.string().trim().toUpperCase().length(3),
    categoryIds: z.array(CUID).max(50).default([]),
    reminderAfterDays: optionalNumber(z.coerce.number().int().min(0).max(60)),
    escalationAfterDays: optionalNumber(z.coerce.number().int().min(0).max(90)),
    steps: z.array(policyStepSchema).min(1).max(10),
  })
  .superRefine((policy, ctx) => {
    const hasRule =
      policy.appliesToAll ||
      policy.costThreshold !== null ||
      policy.categoryIds.length > 0;
    if (!hasRule) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["appliesToAll"],
        message: "Choose 'applies to all' or set a threshold / category rule",
      });
    }
  });

export type UpsertPolicyInput = z.input<typeof upsertPolicySchema>;
export type UpsertPolicyData = z.output<typeof upsertPolicySchema>;

export const reorderPoliciesSchema = z.object({
  orderedIds: z.array(CUID).min(1).max(200),
});

export const setTeamApproverSchema = z.object({
  teamId: CUID,
  userId: CUID.nullable(),
});

export const catalogSearchSchema = z.object({
  query: z.string().trim().min(1).max(80),
});
