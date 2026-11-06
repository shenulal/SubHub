// src/lib/validations/approval-decisions.ts
/**
 * Decision payloads (approve / reject) and the "Rejection reasons" master.
 * Whether an approval comment is mandatory comes from the settings registry
 * (`approvals.requireApproveComment`) and is injected by the caller.
 */
import { z } from "zod";

const ID = z.string().trim().min(1).max(64);
const COMMENT_MAX = 2000;
const CONDITIONS_MAX = 2000;
/** Largest number of requests decided in one bulk call. */
export const BULK_DECISION_LIMIT = 50;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

const optionalId = z
  .union([ID, z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

const isoDate = z
  .union([z.string().date(), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

export interface ApproveSchemaOptions {
  requireComment: boolean;
}

export function buildApproveDecisionSchema(opts: ApproveSchemaOptions) {
  return z
    .object({
      requestId: ID,
      comment: optionalText(COMMENT_MAX),
      conditions: optionalText(CONDITIONS_MAX),
      costCenterId: optionalId,
      categoryId: optionalId,
      effectiveStartDate: isoDate,
    })
    .superRefine((value, ctx) => {
      if (opts.requireComment && !value.comment) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["comment"],
          message: "A comment is required to approve",
        });
      }
    });
}

export type ApproveDecisionData = z.output<
  ReturnType<typeof buildApproveDecisionSchema>
>;

/**
 * `legacy` = the old `{ action, comment }` contract (mobile app builds before
 * decision capture): the reason may be missing and is stored as "not given".
 */
export function buildRejectDecisionSchema(opts: { legacy: boolean }) {
  return z.object({
    requestId: ID,
    reasonId: opts.legacy
      ? optionalId
      : ID.nullish().refine((v) => Boolean(v), {
          message: "Choose a rejection reason",
        }),
    comment: z.preprocess(
      (v) => v ?? "",
      z
        .string()
        .trim()
        .min(1, "A comment is required to reject")
        .max(COMMENT_MAX)
    ),
  });
}

export type RejectDecisionData = {
  requestId: string;
  reasonId: string | null;
  comment: string;
};

/** Approve fields accepted from clients (requestId comes from the route / row). */
export interface ApproveDecisionInput {
  comment?: string | null;
  conditions?: string | null;
  costCenterId?: string | null;
  categoryId?: string | null;
  effectiveStartDate?: string | null;
}

export interface RejectDecisionInput {
  reasonId?: string | null;
  comment: string;
}

export const bulkDecisionSchema = z.object({
  requestIds: z.array(ID).min(1).max(BULK_DECISION_LIMIT),
  action: z.enum(["approve", "reject"]),
  comment: optionalText(COMMENT_MAX),
  reasonId: optionalId,
});

export type BulkDecisionInput = z.input<typeof bulkDecisionSchema>;

export const rejectionReasonInputSchema = z.object({
  code: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toUpperCase() : v),
    z
      .string()
      .min(1)
      .max(32)
      .regex(/^[A-Z0-9_]+$/, "Use letters, digits and underscores")
  ),
  name: z.string().trim().min(1).max(100),
  description: optionalText(300),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

export type RejectionReasonInput = z.output<typeof rejectionReasonInputSchema>;
