// src/lib/services/notification/digest-content.ts
/**
 * Weekly digest content assembly (11.2): legacy stats + pending approvals and
 * committed monthly spend, upcoming renewals, unacknowledged price changes and
 * trial endings. Pure HTML rendering lives here so the scheduler stays small.
 */
import { prisma } from "@/lib/db";
import { formatMoneyForNotification } from "./adapters/money";
import { getBaseUrl } from "./email.utils";

const MS_PER_DAY = 86_400_000;

export interface DigestStats {
  newApps: number;
  unmatchedPayments: number;
  upcomingRenewals: number;
  pendingConfirmations: number;
  pendingApprovals: number;
  /** Monthly spend committed by APPROVED requests (sum of monthlyAmount, base currency). */
  committedMonthlySpend: number;
  committedCurrency: string;
  priceChangesUnacknowledged: number;
  trialsEnding: number;
}

export interface DigestWindow {
  start: Date;
  end: Date;
  renewingSoonDays: number;
  baseCurrency: string;
}

export async function collectDigestStats(
  organizationId: string,
  window: DigestWindow
): Promise<DigestStats> {
  const soon = new Date(
    window.end.getTime() + window.renewingSoonDays * MS_PER_DAY
  );
  const [
    newApps,
    unmatchedPayments,
    upcomingRenewals,
    pendingConfirmations,
    pendingApprovals,
    committed,
    priceChangesUnacknowledged,
    trialsEnding,
  ] = await Promise.all([
    prisma.app.count({
      where: {
        organizationId,
        createdAt: { gte: window.start, lte: window.end },
      },
    }),
    prisma.cardTransaction.count({
      where: {
        organizationId,
        transactionType: "APPROVAL",
        createdAt: { gte: window.start, lte: window.end },
        matchedAppId: null,
      },
    }),
    prisma.subscription.count({
      where: {
        organizationId,
        status: "ACTIVE",
        renewalDate: { gte: window.end, lte: soon },
      },
    }),
    prisma.vendorInferenceLog.count({
      where: {
        organizationId,
        confidence: { gte: 0.5, lte: 0.8 },
        isSaaS: true,
        app: { status: "PENDING_REVIEW" },
      },
    }),
    prisma.approvalRequest.count({
      where: { organizationId, status: { in: ["PENDING", "INFO_REQUESTED"] } },
    }),
    prisma.approvalRequest.aggregate({
      where: { organizationId, status: "APPROVED" },
      _sum: { monthlyAmount: true },
    }),
    prisma.priceChangeEvent.count({
      where: { organizationId, acknowledgedAt: null },
    }),
    prisma.subscription.count({
      where: {
        organizationId,
        status: "ACTIVE",
        isTrial: true,
        trialEndsAt: { gte: window.end, lte: soon },
      },
    }),
  ]);

  return {
    newApps,
    unmatchedPayments,
    upcomingRenewals,
    pendingConfirmations,
    pendingApprovals,
    committedMonthlySpend: Number(committed._sum.monthlyAmount ?? 0),
    committedCurrency: window.baseCurrency,
    priceChangesUnacknowledged,
    trialsEnding,
  };
}

export function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function row(label: string, value: string | number, href: string): string {
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#475569;"><a href="${href}" style="color:#475569;text-decoration:none;">${label}</a></td>
    <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;color:#0f172a;">${value}</td>
  </tr>`;
}

export interface DigestEmail {
  subject: string;
  html: string;
  text: string;
  title: string;
  body: string;
}

export function buildDigestEmail(
  organizationName: string,
  weekRange: string,
  stats: DigestStats,
  renewingSoonDays: number
): DigestEmail {
  const base = getBaseUrl();
  const spend = formatMoneyForNotification(
    stats.committedMonthlySpend,
    stats.committedCurrency
  );
  const title = `Weekly digest · ${weekRange}`;
  const body = `${stats.pendingApprovals} pending approvals, ${stats.upcomingRenewals} renewals in ${renewingSoonDays} days, ${stats.priceChangesUnacknowledged} price changes to review, ${stats.trialsEnding} trials ending.`;
  const html = `<!DOCTYPE html><html lang="en"><body style="font-family:Lato,Inter,Segoe UI,Arial,sans-serif;color:#0f172a;max-width:600px;margin:0 auto;padding:24px;">
  <div style="background:linear-gradient(135deg,#1e293b,#0f172a);color:#fff;padding:24px;border-radius:12px 12px 0 0;">
    <p style="margin:0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.75;">${organizationName}</p>
    <h1 style="margin:8px 0 0;font-size:22px;">Weekly digest</h1>
    <p style="margin:4px 0 0;opacity:.8;">${weekRange}</p>
  </div>
  <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 12px 12px;">
    <h2 style="font-size:14px;letter-spacing:.06em;text-transform:uppercase;color:#64748b;margin:0 0 8px;">Approvals & spend</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      ${row("Pending approvals", stats.pendingApprovals, `${base}/approvals`)}
      ${row("Committed monthly spend (approved)", spend, `${base}/approvals`)}
    </table>
    <h2 style="font-size:14px;letter-spacing:.06em;text-transform:uppercase;color:#64748b;margin:20px 0 8px;">Renewals & pricing</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      ${row(`Renewing in the next ${renewingSoonDays} days`, stats.upcomingRenewals, `${base}/subscriptions/pipeline`)}
      ${row("Trials ending soon", stats.trialsEnding, `${base}/subscriptions`)}
      ${row("Price changes to acknowledge", stats.priceChangesUnacknowledged, `${base}/subscriptions`)}
    </table>
    <h2 style="font-size:14px;letter-spacing:.06em;text-transform:uppercase;color:#64748b;margin:20px 0 8px;">Discovery</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      ${row("New apps this week", stats.newApps, `${base}/apps`)}
      ${row("Unmatched card payments", stats.unmatchedPayments, `${base}/payments`)}
      ${row("Apps awaiting confirmation", stats.pendingConfirmations, `${base}/extensions/review-apps`)}
    </table>
    <p style="text-align:center;margin:24px 0 0;"><a href="${base}/dashboard" style="display:inline-block;background:#0f172a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Open SubHub</a></p>
  </div>
  <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:16px;">You can opt out under Settings → Notifications.</p>
</body></html>`;
  return {
    subject: `[${organizationName}] ${title}`,
    html,
    text: `${title}. ${body} ${base}/dashboard`,
    title,
    body,
  };
}
