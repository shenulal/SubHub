// src/lib/services/receipts/parser.fixtures.shared.ts
/** Fixture type + builder shared by the two fixture modules (avoids a circular import). */
import type { RawMessage } from "@/types/receipts";
import type { BillingCycle } from "@prisma/client";

export interface ReceiptFixture {
  name: string;
  message: RawMessage;
  expect: {
    vendor?: string;
    amount?: number;
    currency?: string;
    cycle?: BillingCycle | null;
    trial?: boolean;
    nextRenewal?: string;
    chargedAt?: string;
    /** confidence must be >= this */
    minConfidence?: number;
    /** confidence must be < this */
    maxConfidence?: number;
  };
}

export const msg = (
  id: string,
  from: string,
  subject: string,
  date: string,
  bodyText: string,
  bodyHtml?: string
): RawMessage => ({
  id,
  from,
  subject,
  date,
  snippet: bodyText.slice(0, 120),
  bodyText,
  bodyHtml,
});
