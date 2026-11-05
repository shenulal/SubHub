// src/lib/validations/receipts.ts
import { multiValueSchema } from "@/lib/filters/multi-value";
import { BillingCycle, ReceiptSuggestionStatus } from "@prisma/client";
import { z } from "zod";

const idSchema = z.string().min(1).max(64);

export const mailboxProviderParamSchema = z.enum(["gmail", "outlook"]);
export type MailboxProviderParam = z.infer<typeof mailboxProviderParamSchema>;

export const receiptSuggestionFilterSchema = z.object({
  status: z.nativeEnum(ReceiptSuggestionStatus).optional(),
  /** Mailboxes (multi-select, empty = all); CSV / legacy single id accepted. */
  mailboxId: multiValueSchema(idSchema),
  mailboxIds: multiValueSchema(idSchema),
  minConfidence: z.coerce.number().min(0).max(1).optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type ReceiptSuggestionFilter = z.input<
  typeof receiptSuggestionFilterSchema
>;

const amountSchema = z.coerce.number().min(0).max(1_000_000_000);
const isoDateSchema = z
  .string()
  .min(1)
  .refine((v) => !Number.isNaN(new Date(v).getTime()), "Invalid date");

export const acceptReceiptSuggestionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  amount: amountSchema,
  currency: z.string().trim().length(3).toUpperCase(),
  billingCycle: z.nativeEnum(BillingCycle),
  startDate: isoDateSchema,
  renewalDate: isoDateSchema.nullish(),
  categoryId: idSchema.nullish(),
  isTrial: z.boolean().default(false),
  trialEndsAt: isoDateSchema.nullish(),
  notes: z.string().trim().max(1000).nullish(),
});
export type AcceptReceiptSuggestionInput = z.input<
  typeof acceptReceiptSuggestionSchema
>;

export const linkReceiptSuggestionSchema = z.object({
  subscriptionId: idSchema,
  updateLastDetectedAmount: z.boolean().default(true),
});
export type LinkReceiptSuggestionInput = z.input<
  typeof linkReceiptSuggestionSchema
>;

export const dismissReceiptSuggestionsSchema = z.object({
  ids: z.array(idSchema).min(1).max(200),
});

export const suggestionApiActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("accept"),
    data: acceptReceiptSuggestionSchema,
  }),
  z.object({ action: z.literal("dismiss") }),
  z.object({ action: z.literal("link"), data: linkReceiptSuggestionSchema }),
]);

export const mailboxIdSchema = idSchema;
