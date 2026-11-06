// src/lib/masters/rejection-reasons.ts
/**
 * Default "Rejection reasons" master seeded per organisation. Approvers pick one
 * of these (plus a comment) when they reject a request; administrators edit the
 * list under Settings → Master data → Rejection reasons.
 */
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

type Db = Prisma.TransactionClient | typeof prisma;

export interface DefaultRejectionReason {
  code: string;
  name: string;
  description: string;
}

export const DEFAULT_REJECTION_REASONS: DefaultRejectionReason[] = [
  {
    code: "BUDGET",
    name: "No budget available",
    description: "The cost centre has no budget left for this period.",
  },
  {
    code: "DUPLICATE",
    name: "Duplicate of an existing tool",
    description: "The organisation already pays for a tool that covers this.",
  },
  {
    code: "SECURITY",
    name: "Security or compliance concern",
    description:
      "The vendor does not meet security, privacy or data-residency rules.",
  },
  {
    code: "JUSTIFICATION",
    name: "Business case not sufficient",
    description: "The justification does not show enough value for the cost.",
  },
  {
    code: "ALTERNATIVE",
    name: "Cheaper alternative available",
    description: "A lower-cost plan or another vendor fits the need.",
  },
  {
    code: "OTHER",
    name: "Other",
    description: "Explain the reason in the comment.",
  },
];

/** Seeds the default reasons once; never touches an organisation that has any. */
export async function ensureDefaultRejectionReasons(
  organizationId: string,
  db: Db = prisma
): Promise<void> {
  const existing = await db.approvalRejectionReason.count({
    where: { organizationId },
  });
  if (existing > 0) return;
  await db.approvalRejectionReason.createMany({
    data: DEFAULT_REJECTION_REASONS.map((r, i) => ({
      organizationId,
      code: r.code,
      name: r.name,
      description: r.description,
      sortOrder: i,
    })),
    skipDuplicates: true,
  });
}
