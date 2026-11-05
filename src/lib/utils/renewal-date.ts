import type { BillingCycle } from "@prisma/client";

/**
 * Helper that calculates the next renewal date
 * Returns the current renewal date plus one billingCycle period.
 * If the result is in the past, it keeps advancing until it is in the future.
 */
export function calculateNextRenewalDate(
  lastPaymentDate: Date,
  billingCycle: BillingCycle
): Date {
  const next = new Date(lastPaymentDate);

  switch (billingCycle) {
    case "MONTHLY":
      next.setMonth(next.getMonth() + 1);
      break;
    case "QUARTERLY":
      next.setMonth(next.getMonth() + 3);
      break;
    case "YEARLY":
      next.setFullYear(next.getFullYear() + 1);
      break;
    case "ONE_TIME":
    default:
      break;
  }

  const now = new Date();
  while (next < now) {
    switch (billingCycle) {
      case "MONTHLY":
        next.setMonth(next.getMonth() + 1);
        break;
      case "QUARTERLY":
        next.setMonth(next.getMonth() + 3);
        break;
      case "YEARLY":
        next.setFullYear(next.getFullYear() + 1);
        break;
      default:
        return next;
    }
  }

  return next;
}

/**
 * Advances a past renewal date to a date after now.
 * Unlike calculateNextRenewalDate, it does not add the first period;
 * it is only used to roll dates that are already past forward into the future.
 */
export function advanceToFutureDate(
  renewalDate: Date,
  billingCycle: BillingCycle
): Date {
  const next = new Date(renewalDate);
  const now = new Date();

  if (next >= now) {
    return next;
  }

  while (next < now) {
    switch (billingCycle) {
      case "MONTHLY":
        next.setMonth(next.getMonth() + 1);
        break;
      case "QUARTERLY":
        next.setMonth(next.getMonth() + 3);
        break;
      case "YEARLY":
        next.setFullYear(next.getFullYear() + 1);
        break;
      case "ONE_TIME":
      default:
        return next;
    }
  }

  return next;
}
