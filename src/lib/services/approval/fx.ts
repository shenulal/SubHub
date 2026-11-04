// src/lib/services/approval/fx.ts
/**
 * Minimal currency conversion for approval thresholds.
 *
 * TODO(fx): replace with `convertAmount` from `@/lib/fx` once the finance area
 * ships the shared FX helper. Until then this reads the latest `ExchangeRate`
 * row for the pair (or its inverse) and falls back to rate 1 when none exists.
 */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { Prisma } from "@prisma/client";

type Db = Prisma.TransactionClient | typeof prisma;

export async function getLatestRate(
  from: string,
  to: string,
  db: Db = prisma
): Promise<number> {
  if (from === to) return 1;
  const direct = await db.exchangeRate.findFirst({
    where: { baseCurrency: from, quoteCurrency: to },
    orderBy: { asOf: "desc" },
    select: { rate: true },
  });
  if (direct) return Number(direct.rate);
  const inverse = await db.exchangeRate.findFirst({
    where: { baseCurrency: to, quoteCurrency: from },
    orderBy: { asOf: "desc" },
    select: { rate: true },
  });
  if (inverse && Number(inverse.rate) > 0) return 1 / Number(inverse.rate);
  logger.warn({ from, to }, "[approvals/fx] no exchange rate found, using 1");
  return 1;
}

export async function convertAmount(
  amount: number,
  from: string,
  to: string,
  db: Db = prisma
): Promise<number> {
  const rate = await getLatestRate(from, to, db);
  return amount * rate;
}
