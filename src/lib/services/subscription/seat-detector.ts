// src/lib/services/subscription/seat-detector.ts
/**
 * Per-seat subscription auto-detection service
 *
 * Analyses payment amount patterns to decide between FLAT_RATE and PER_SEAT billing.
 * - Step 1: SaaS catalog lookup (DB pricingModel → hard-coded fallback)
 * - Step 2: check whether amounts vary
 * - Step 3: GCD-based per-seat price extraction (with tolerance)
 * - Step 4: use the catalog base price (when amounts are constant)
 */

import type { BillingType } from "@prisma/client";

/**
 * @deprecated R1: to be replaced by DB SaaSCatalog.pricingModel. Kept as a fallback only.
 * Known PER_SEAT SaaS list (usage-based excluded)
 */
const KNOWN_PER_SEAT_SAAS = new Set(
  [
    "Slack",
    "Notion",
    "Figma",
    "GitHub",
    "GitLab",
    "Jira",
    "Confluence",
    "Asana",
    "Monday.com",
    "Linear",
    "Zoom",
    "Microsoft 365",
    "Google Workspace",
    "Dropbox Business",
    "1Password",
    "LastPass",
    "Salesforce",
    "HubSpot",
    "Zendesk",
    "Intercom",
    "Datadog",
    "New Relic",
    "PagerDuty",
    "Okta",
    "Auth0",
    // Vercel, AWS, Netlify removed (usage-based)
    "Atlassian",
    "Trello",
    "Miro",
    "Loom",
    "Canva",
    "Adobe Creative Cloud",
    "InVision",
    "Postman",
    "Sentry",
  ].map((n) => n.toLowerCase())
);

/** Minimum confidence threshold for GCD results */
const MIN_GCD_CONFIDENCE = 0.5;

/** R2: tolerance ratio (5%) */
const TOLERANCE_RATIO = 0.05;

/** R3: maximum seat count when back-calculating from the catalog base price */
const MAX_CATALOG_SEATS = 500;

/** R5: seat detection method */
export type DetectionMethod =
  | "catalog_known" // Confirmed PER_SEAT in the DB catalog
  | "gcd_exact" // Per-seat price from an exact GCD
  | "gcd_tolerance" // Per-seat price from a GCD with tolerance
  | "gcd_vat_adjusted" // GCD after removing VAT
  | "catalog_price" // Back-calculated from the catalog base price
  | "heuristic_known" // Based on the hard-coded list (fallback)
  | "unknown"; // Undetermined

export interface DetectBillingTypeInput {
  appName: string;
  amounts: number[];
  /** R1: DB SaaSCatalog.pricingModel value */
  catalogPricingModel?: string | null;
  /** R3: DB SaaSCatalog.basePricePerSeat value (converted to the payment currency) */
  catalogBasePricePerSeat?: number | null;
  /**
   * Sales-tax rate (percent) that may be included in the charged amounts, from the
   * organisation's default tax rate master (e.g. 5 for UAE VAT). When omitted or 0,
   * the tax-removal step is skipped.
   */
  taxRatePercent?: number | null;
}

export interface DetectBillingTypeResult {
  billingType: BillingType;
  confidence: number;
  perSeatPrice: number | null;
  suggestedSeats: number | null;
  /** R5: detection method */
  method: DetectionMethod;
}

export interface SeatPriceResult {
  seatPrice: number | null;
  confidence: number;
  /** R2: approximation method */
  approxMethod: "exact" | "vat_adjusted" | "tolerance";
}

/**
 * Checks whether the SaaS is a known PER_SEAT product
 * R1: catalogPricingModel takes priority
 * 1. catalogPricingModel === "PER_SEAT" → true
 * 2. catalogPricingModel === "FLAT_RATE" | "USAGE_BASED" → false
 * 3. catalogPricingModel === null/undefined → hard-coded fallback
 */
export function isKnownPerSeatSaaS(
  appName: string,
  catalogPricingModel?: string | null
): boolean {
  // R1: DB catalog first
  if (catalogPricingModel === "PER_SEAT") return true;
  if (
    catalogPricingModel === "FLAT_RATE" ||
    catalogPricingModel === "USAGE_BASED"
  ) {
    return false;
  }
  // Fallback: hard-coded list
  return KNOWN_PER_SEAT_SAAS.has(appName.toLowerCase());
}

/**
 * Checks whether amounts vary (false when all amounts are equal)
 */
export function hasAmountVariation(amounts: number[]): boolean {
  if (amounts.length <= 1) return false;
  const first = amounts[0];
  return amounts.some((a) => a !== first);
}

/**
 * Greatest common divisor of two numbers (Euclidean algorithm)
 */
export function calculateGCD(a: number, b: number): number {
  a = Math.round(Math.abs(a));
  b = Math.round(Math.abs(b));
  while (b !== 0) {
    const temp = b;
    b = a % b;
    a = temp;
  }
  return a;
}

/**
 * Extracts a GCD-based per-seat price from payment amounts (exact GCD)
 * Checks that every amount is a multiple of a single unit price
 */
export function extractSeatPrice(amounts: number[]): SeatPriceResult {
  if (amounts.length < 2) {
    return { seatPrice: null, confidence: 0, approxMethod: "exact" };
  }

  // GCD of all amounts
  let gcd = Math.round(amounts[0]);
  for (let i = 1; i < amounts.length; i++) {
    gcd = calculateGCD(gcd, Math.round(amounts[i]));
  }

  // A GCD that is too small (e.g. 1 unit) is meaningless
  if (gcd < 100) {
    return { seatPrice: null, confidence: 0.1, approxMethod: "exact" };
  }

  // Verify every amount is a multiple of the GCD (reasonable seat range: 1–1000)
  const seatCounts = amounts.map((a) => Math.round(a / gcd));
  const allReasonable = seatCounts.every((s) => s >= 1 && s <= 1000);

  if (!allReasonable) {
    return { seatPrice: null, confidence: 0.2, approxMethod: "exact" };
  }

  // Check that seat counts vary (variation is required for a PER_SEAT pattern)
  const uniqueSeatCounts = new Set(seatCounts);
  const hasVariation = uniqueSeatCounts.size > 1;

  const confidence = hasVariation ? 0.8 : 0.4;

  return {
    seatPrice: gcd,
    confidence,
    approxMethod: "exact",
  };
}

/**
 * R2: verifies a candidate unit price against all amounts (with tolerance)
 */
function validateCandidatePrice(
  amounts: number[],
  candidatePrice: number,
  tolerance: number = TOLERANCE_RATIO
): { valid: boolean; maxError: number; seatCounts: number[] } {
  if (candidatePrice < 100) {
    return { valid: false, maxError: 1, seatCounts: [] };
  }

  const seatCounts: number[] = [];
  let maxError = 0;

  for (const amount of amounts) {
    const estimatedSeats = Math.round(amount / candidatePrice);
    if (estimatedSeats < 1 || estimatedSeats > 1000) {
      return { valid: false, maxError: 1, seatCounts: [] };
    }
    const error = Math.abs(amount - estimatedSeats * candidatePrice) / amount;
    maxError = Math.max(maxError, error);
    if (error > tolerance) {
      return { valid: false, maxError, seatCounts: [] };
    }
    seatCounts.push(estimatedSeats);
  }

  return { valid: true, maxError, seatCounts };
}

/** Maximum relative error when checking that amounts are tax-inclusive. */
const TAX_RECONSTRUCTION_TOLERANCE = 0.01;

/**
 * R2: attempts to remove sales tax (the organisation's configured rate)
 * If every amount is close to a tax-inclusive value, returns the amounts without tax.
 */
function tryRemoveTax(
  amounts: number[],
  taxRatePercent: number
): number[] | null {
  const taxFactor = 1 + taxRatePercent / 100;
  const adjusted = amounts.map((a) => Math.round(a / taxFactor));

  // Check that every adjusted amount reconstructs the original once tax is added back
  const allValid = amounts.every((original, i) => {
    const reconstructed = Math.round(adjusted[i] * taxFactor);
    const error = Math.abs(original - reconstructed) / original;
    return error < TAX_RECONSTRUCTION_TOLERANCE;
  });

  return allValid ? adjusted : null;
}

/**
 * R2: tolerance-based per-seat price extraction
 * Tries exact GCD → tax removal (when a rate is given) → tolerance, in that order
 */
export function extractSeatPriceWithTolerance(
  amounts: number[],
  taxRatePercent?: number | null
): SeatPriceResult {
  if (amounts.length < 2) {
    return { seatPrice: null, confidence: 0, approxMethod: "exact" };
  }

  // Step 1: try an exact GCD
  const exactResult = extractSeatPrice(amounts);
  if (exactResult.seatPrice && exactResult.confidence >= MIN_GCD_CONFIDENCE) {
    return exactResult;
  }

  // Step 2: retry after removing the organisation's sales tax
  const vatAdjusted =
    taxRatePercent && taxRatePercent > 0
      ? tryRemoveTax(amounts, taxRatePercent)
      : null;
  if (vatAdjusted) {
    const vatResult = extractSeatPrice(vatAdjusted);
    if (vatResult.seatPrice && vatResult.confidence >= MIN_GCD_CONFIDENCE) {
      return {
        seatPrice: vatResult.seatPrice,
        confidence: vatResult.confidence - 0.05,
        approxMethod: "vat_adjusted",
      };
    }
  }

  // Step 3: validate candidate unit prices with tolerance
  const sortedAmounts = [...amounts].sort((a, b) => a - b);
  const minAmount = sortedAmounts[0];

  // Candidate unit prices: GCD, min, min/2, min/3, ..., min/10
  const candidates = new Set<number>();
  // The GCD itself is a candidate
  let gcd = Math.round(amounts[0]);
  for (let i = 1; i < amounts.length; i++) {
    gcd = calculateGCD(gcd, Math.round(amounts[i]));
  }
  if (gcd >= 100) candidates.add(gcd);
  // The minimum divided by 1–10 are candidates too
  for (let div = 1; div <= 10; div++) {
    const c = Math.round(minAmount / div);
    if (c >= 100) candidates.add(c);
  }
  // Differences between adjacent amounts are candidates too
  for (let i = 1; i < sortedAmounts.length; i++) {
    const diff = Math.round(sortedAmounts[i] - sortedAmounts[i - 1]);
    if (diff >= 100) candidates.add(diff);
  }

  let bestResult: SeatPriceResult | null = null;
  let bestError = 1;

  for (const candidate of candidates) {
    const validation = validateCandidatePrice(amounts, candidate);
    if (validation.valid) {
      const hasVariation = new Set(validation.seatCounts).size > 1;
      const maxSeats = Math.max(...validation.seatCounts);
      const minSeats = Math.min(...validation.seatCounts);
      // Skip unit prices below 20% of the minimum amount (too small)
      if (candidate < minAmount * 0.2) continue;
      // Invalid if the seat count range is too wide (5x or more)
      if (maxSeats > minSeats * 5) continue;

      const baseConfidence = hasVariation ? 0.75 : 0.35;
      const adjustedConfidence = baseConfidence - validation.maxError * 0.5;

      if (
        !bestResult ||
        adjustedConfidence > bestResult.confidence ||
        (adjustedConfidence === bestResult.confidence &&
          validation.maxError < bestError)
      ) {
        bestResult = {
          seatPrice: candidate,
          confidence: adjustedConfidence,
          approxMethod: "tolerance",
        };
        bestError = validation.maxError;
      }
    }
  }

  if (bestResult && bestResult.confidence >= MIN_GCD_CONFIDENCE) {
    return bestResult;
  }

  // Also try tolerance with VAT-adjusted amounts
  if (vatAdjusted) {
    const vatSortedAmounts = [...vatAdjusted].sort((a, b) => a - b);
    const vatMinAmount = vatSortedAmounts[0];
    const vatCandidates = new Set<number>();

    let vatGcd = Math.round(vatAdjusted[0]);
    for (let i = 1; i < vatAdjusted.length; i++) {
      vatGcd = calculateGCD(vatGcd, Math.round(vatAdjusted[i]));
    }
    if (vatGcd >= 100) vatCandidates.add(vatGcd);
    for (let div = 1; div <= 10; div++) {
      const c = Math.round(vatMinAmount / div);
      if (c >= 100) vatCandidates.add(c);
    }

    for (const candidate of vatCandidates) {
      // Skip unit prices below 20% of the minimum amount (too small)
      if (candidate < vatMinAmount * 0.2) continue;
      const validation = validateCandidatePrice(vatAdjusted, candidate);
      if (validation.valid) {
        const hasVariation = new Set(validation.seatCounts).size > 1;
        const maxSeats = Math.max(...validation.seatCounts);
        const minSeats = Math.min(...validation.seatCounts);
        if (maxSeats > minSeats * 5) continue;

        const baseConfidence = hasVariation ? 0.7 : 0.3;
        const adjustedConfidence = baseConfidence - validation.maxError * 0.5;

        if (
          (!bestResult || adjustedConfidence > bestResult.confidence) &&
          adjustedConfidence >= MIN_GCD_CONFIDENCE
        ) {
          bestResult = {
            seatPrice: candidate,
            confidence: adjustedConfidence,
            approxMethod: "vat_adjusted",
          };
        }
      }
    }
  }

  return (
    bestResult || {
      seatPrice: null,
      confidence: exactResult.confidence,
      approxMethod: "exact",
    }
  );
}

/**
 * Automatically determines billingType from payment patterns
 *
 * Rules:
 * 1. catalogPricingModel first (DB catalog)
 * 2. Known PER_SEAT SaaS + varying amounts + valid GCD → PER_SEAT (0.9)
 * 3. Known PER_SEAT SaaS + constant amounts + catalog base price → PER_SEAT (0.85)
 * 4. Known PER_SEAT SaaS + constant amounts → PER_SEAT (0.8), perSeatPrice=null
 * 5. Unknown SaaS + varying amounts + valid GCD → PER_SEAT (0.7)
 * 6. Otherwise → FLAT_RATE (0.5)
 */
export function detectBillingType(
  input: DetectBillingTypeInput
): DetectBillingTypeResult {
  const {
    appName,
    amounts,
    catalogPricingModel,
    catalogBasePricePerSeat,
    taxRatePercent,
  } = input;

  // No payment data
  if (amounts.length === 0) {
    return {
      billingType: "FLAT_RATE",
      confidence: 0,
      perSeatPrice: null,
      suggestedSeats: null,
      method: "unknown",
    };
  }

  const isKnown = isKnownPerSeatSaaS(appName, catalogPricingModel);
  const isCatalogKnown = catalogPricingModel === "PER_SEAT";

  // Decide the detection source
  const knownMethod: DetectionMethod = isCatalogKnown
    ? "catalog_known"
    : "heuristic_known";

  // Only a single payment
  if (amounts.length === 1) {
    if (isKnown) {
      // R3: try back-calculating from the catalog base price
      if (catalogBasePricePerSeat && catalogBasePricePerSeat >= 100) {
        const estimatedSeats = Math.round(amounts[0] / catalogBasePricePerSeat);
        if (estimatedSeats >= 1 && estimatedSeats <= MAX_CATALOG_SEATS) {
          return {
            billingType: "PER_SEAT",
            confidence: 0.7,
            perSeatPrice: catalogBasePricePerSeat,
            suggestedSeats: estimatedSeats,
            method: "catalog_price",
          };
        }
      }
      return {
        billingType: "PER_SEAT",
        confidence: 0.6,
        perSeatPrice: null,
        suggestedSeats: null,
        method: knownMethod,
      };
    }
    return {
      billingType: "FLAT_RATE",
      confidence: 0.3,
      perSeatPrice: null,
      suggestedSeats: null,
      method: "unknown",
    };
  }

  // Step 2: check whether amounts vary
  const hasVariation = hasAmountVariation(amounts);

  // Step 3: R2 - GCD-based per-seat price extraction with tolerance
  const seatPriceResult = hasVariation
    ? extractSeatPriceWithTolerance(amounts, taxRatePercent)
    : { seatPrice: null, confidence: 0, approxMethod: "exact" as const };

  const gcdValid = seatPriceResult.confidence >= MIN_GCD_CONFIDENCE;

  if (isKnown) {
    if (hasVariation && gcdValid) {
      // Known SaaS + varying amounts + valid GCD
      const latestAmount = amounts[amounts.length - 1];
      const suggestedSeats = seatPriceResult.seatPrice
        ? Math.round(latestAmount / seatPriceResult.seatPrice)
        : null;

      // R2: slightly lower confidence for the tolerance method
      const baseConfidence = 0.9;
      const confidence =
        seatPriceResult.approxMethod === "exact"
          ? baseConfidence
          : baseConfidence - 0.05;

      // R5: decide the method
      let method: DetectionMethod;
      if (seatPriceResult.approxMethod === "exact") {
        method = "gcd_exact";
      } else if (seatPriceResult.approxMethod === "vat_adjusted") {
        method = "gcd_vat_adjusted";
      } else {
        method = "gcd_tolerance";
      }

      return {
        billingType: "PER_SEAT",
        confidence,
        perSeatPrice: seatPriceResult.seatPrice,
        suggestedSeats,
        method,
      };
    }

    // R3: known SaaS + constant amounts → try back-calculating from the catalog base price
    if (
      !hasVariation &&
      catalogBasePricePerSeat &&
      catalogBasePricePerSeat >= 100
    ) {
      const avgAmount = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
      const estimatedSeats = Math.round(avgAmount / catalogBasePricePerSeat);
      if (estimatedSeats >= 1 && estimatedSeats <= MAX_CATALOG_SEATS) {
        return {
          billingType: "PER_SEAT",
          confidence: 0.85,
          perSeatPrice: catalogBasePricePerSeat,
          suggestedSeats: estimatedSeats,
          method: "catalog_price",
        };
      }
    }

    // Known SaaS + constant amounts → PER_SEAT (0.8), perSeatPrice unknown
    return {
      billingType: "PER_SEAT",
      confidence: 0.8,
      perSeatPrice: null,
      suggestedSeats: null,
      method: knownMethod,
    };
  }

  // R1: when catalogPricingModel is explicitly USAGE_BASED or FLAT_RATE,
  // never classify as PER_SEAT regardless of the GCD pattern
  if (
    catalogPricingModel === "USAGE_BASED" ||
    catalogPricingModel === "FLAT_RATE"
  ) {
    return {
      billingType: "FLAT_RATE",
      confidence: 0.8,
      perSeatPrice: null,
      suggestedSeats: null,
      method: "catalog_known",
    };
  }

  // Unknown SaaS + varying amounts + valid GCD → PER_SEAT (0.7)
  if (hasVariation && gcdValid) {
    const latestAmount = amounts[amounts.length - 1];
    const suggestedSeats = seatPriceResult.seatPrice
      ? Math.round(latestAmount / seatPriceResult.seatPrice)
      : null;

    let method: DetectionMethod;
    if (seatPriceResult.approxMethod === "exact") {
      method = "gcd_exact";
    } else if (seatPriceResult.approxMethod === "vat_adjusted") {
      method = "gcd_vat_adjusted";
    } else {
      method = "gcd_tolerance";
    }

    return {
      billingType: "PER_SEAT",
      confidence: 0.7,
      perSeatPrice: seatPriceResult.seatPrice,
      suggestedSeats,
      method,
    };
  }

  // Otherwise → FLAT_RATE (0.5)
  return {
    billingType: "FLAT_RATE",
    confidence: 0.5,
    perSeatPrice: null,
    suggestedSeats: null,
    method: "unknown",
  };
}
