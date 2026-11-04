// src/lib/services/approval/policy-matcher.ts
/**
 * Picks the approval policy that governs a new request.
 *
 * Policies are evaluated from highest `priority` to lowest. A policy matches when
 *  - `appliesToAll` is set, or
 *  - every configured rule holds: the monthly-normalised amount (converted into
 *    the policy's threshold currency) is >= `costThreshold`, and/or the request
 *    category is one of `categoryIds`.
 * A policy with no rule at all never matches (treated as misconfigured).
 */
import { prisma } from "@/lib/db";
import type {
  ApprovalPolicy,
  ApprovalPolicyStep,
  Prisma,
} from "@prisma/client";
import { convertAmount } from "./fx";

type Db = Prisma.TransactionClient | typeof prisma;

export type PolicyWithSteps = ApprovalPolicy & { steps: ApprovalPolicyStep[] };

export interface PolicyMatchInput {
  monthlyAmount: number;
  currency: string;
  categoryId: string | null;
}

export function policyRuleMatches(
  policy: Pick<
    ApprovalPolicy,
    "appliesToAll" | "costThreshold" | "categoryIds"
  >,
  input: PolicyMatchInput,
  monthlyInPolicyCurrency: number
): boolean {
  if (policy.appliesToAll) return true;
  const hasThreshold = policy.costThreshold !== null;
  const hasCategories = policy.categoryIds.length > 0;
  if (!hasThreshold && !hasCategories) return false;
  if (hasThreshold && monthlyInPolicyCurrency < Number(policy.costThreshold)) {
    return false;
  }
  if (
    hasCategories &&
    (!input.categoryId || !policy.categoryIds.includes(input.categoryId))
  ) {
    return false;
  }
  return true;
}

export async function loadActivePolicies(
  organizationId: string,
  db: Db = prisma
): Promise<PolicyWithSteps[]> {
  return db.approvalPolicy.findMany({
    where: { organizationId, isActive: true },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });
}

export async function matchPolicy(
  organizationId: string,
  input: PolicyMatchInput,
  db: Db = prisma
): Promise<PolicyWithSteps | null> {
  const policies = await loadActivePolicies(organizationId, db);
  const converted = new Map<string, number>();
  for (const policy of policies) {
    if (policy.appliesToAll) return policy;
    const target = policy.costThresholdCurrency;
    if (policy.costThreshold !== null && !converted.has(target)) {
      converted.set(
        target,
        await convertAmount(input.monthlyAmount, input.currency, target, db)
      );
    }
    const monthly = converted.get(target) ?? input.monthlyAmount;
    if (policyRuleMatches(policy, input, monthly)) return policy;
  }
  return null;
}
