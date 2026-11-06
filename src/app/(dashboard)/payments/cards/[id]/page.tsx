// src/app/(dashboard)/payments/cards/[id]/page.tsx
import {
  getCardTransactions,
  getCardTransactionSummary,
  getCorporateCardCached,
} from "@/actions/corporate-cards";
import { CardTransactionsTable } from "@/components/cards/card-transactions-table";
import { SyncHistoryPanel } from "@/components/cards/sync-history-panel";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { requirePermissionOrRedirect } from "@/lib/rbac/service";
import {
  CARD_COMPANIES,
  type CardCompanyCode,
} from "@/lib/services/hyphen/types";
import { formatDistanceToNow } from "date-fns";
import { enUS } from "date-fns/locale";
import { CheckCircle, Clock, CreditCard, XCircle } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTranslations("cards.detail");
  const { id } = await params;
  const card = await getCorporateCardCached(id);

  if (!card) {
    return { title: t("notFound") };
  }

  const cardCompany =
    CARD_COMPANIES[card.cardCd as CardCompanyCode] || card.cardCd;
  return {
    title: `${cardCompany} **** ${card.cardLast4 || "****"} | ${t("title")}`,
    description: t("description"),
  };
}

export default async function CardDetailPage({ params }: Props) {
  const { organizationId } = await requirePermissionOrRedirect(
    "payments:manage",
    "/payments/cards"
  );
  const t = await getTranslations("cards.detail");
  const dateLocale = enUS;

  const { id } = await params;
  const card = await getCorporateCardCached(id);

  if (!card) {
    notFound();
  }

  // Initial transaction fetch (SaaS tab is the default)
  const initialTransactions = await getCardTransactions({
    cardId: id,
    page: 1,
    pageSize: 20,
    filter: "saas",
  });

  // Fetch classification summary data
  const summary = await getCardTransactionSummary(organizationId, id);

  // Fetch the app list for matching
  const apps = await prisma.app.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  const cardCompany =
    CARD_COMPANIES[card.cardCd as CardCompanyCode] || card.cardCd;

  const getSyncStatus = () => {
    if (card.lastError) {
      return (
        <Badge variant="error" className="gap-1">
          <XCircle className="h-3 w-3" />
          {t("syncStatus.error")}
        </Badge>
      );
    }
    if (card.lastSyncAt) {
      return (
        <Badge variant="success" className="gap-1">
          <CheckCircle className="h-3 w-3" />
          {t("syncStatus.synced")}
        </Badge>
      );
    }
    return (
      <Badge variant="warning" className="gap-1">
        <Clock className="h-3 w-3" />
        {t("syncStatus.pending")}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <span className="tonal-primary flex size-12 shrink-0 items-center justify-center rounded-md">
          <CreditCard className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-foreground truncate text-2xl font-medium">
            {card.cardNm || cardCompany}
          </h1>
          <p className="text-muted-foreground truncate text-[0.9375rem] tabular-nums">
            {cardCompany} **** {card.cardLast4 || "****"}
          </p>
        </div>
        <div className="shrink-0">{getSyncStatus()}</div>
      </div>

      {/* Card info summary */}
      <Card className="border-border dark:border-border border shadow-none">
        <CardHeader>
          <CardTitle>{t("cardInfo")}</CardTitle>
          <CardDescription>{t("cardInfoDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="bg-muted/60 min-w-0 rounded-md px-4 py-3">
              <div className="text-muted-foreground truncate text-[0.8125rem]">
                {t("cardCompany")}
              </div>
              <div className="text-foreground truncate font-medium">
                {cardCompany}
              </div>
            </div>
            <div className="bg-muted/60 min-w-0 rounded-md px-4 py-3">
              <div className="text-muted-foreground truncate text-[0.8125rem]">
                {t("cardNumber")}
              </div>
              <div className="text-foreground truncate font-medium tabular-nums">
                **** **** **** {card.cardLast4 || "****"}
              </div>
            </div>
            <div className="bg-muted/60 min-w-0 rounded-md px-4 py-3">
              <div className="text-muted-foreground truncate text-[0.8125rem]">
                {t("loginMethod")}
              </div>
              <div className="text-foreground truncate font-medium">
                {card.loginMethod === "ID"
                  ? t("loginMethodId")
                  : t("loginMethodCert")}
              </div>
            </div>
            <div className="bg-muted/60 min-w-0 rounded-md px-4 py-3">
              <div className="text-muted-foreground truncate text-[0.8125rem]">
                {t("lastSync")}
              </div>
              <div className="text-foreground truncate font-medium">
                {card.lastSyncAt
                  ? formatDistanceToNow(new Date(card.lastSyncAt), {
                      addSuffix: true,
                      locale: dateLocale,
                    })
                  : t("notSynced")}
              </div>
            </div>
          </div>
          {card.lastError && (
            <div className="tonal-error mt-4 rounded-md p-3 text-sm break-words">
              <strong>{t("lastError")}</strong> {card.lastError}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync history */}
      <SyncHistoryPanel corporateCardId={id} limit={10} />

      {/* Transactions table */}
      <Card className="border-border dark:border-border border shadow-none">
        <CardHeader>
          <CardTitle>{t("transactions")}</CardTitle>
          <CardDescription>
            {t("transactionsDescription", {
              total: summary.totalCount,
              saas: summary.saasMatchedCount,
              unmatched: summary.unmatchedCount,
              nonSaas: summary.nonSaaSCount,
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CardTransactionsTable
            cardId={id}
            apps={apps}
            initialData={initialTransactions}
            summary={summary}
          />
        </CardContent>
      </Card>
    </div>
  );
}
