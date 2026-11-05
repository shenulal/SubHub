// src/components/payments/payment-table-columns.tsx
"use client";

import type { PaymentRecordWithApp } from "@/actions/payment-import";
import type { DataTableColumn } from "@/components/common/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link2, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import {
  formatAmount,
  formatDate,
  getStatusLabels,
  STATUS_COLORS,
} from "./payment-table.constants";

interface App {
  id: string;
  name: string;
}

interface Subscription {
  id: string;
  appName: string;
}

interface UsePaymentTableColumnsProps {
  apps: App[];
  subscriptions: Subscription[];
  isPending: boolean;
  onMatchUpdate: (paymentId: string, appId: string | null) => void;
  onLinkSubscription: (paymentId: string, subscriptionId: string) => void;
  onRegisterApp?: (record: PaymentRecordWithApp) => void;
  onRegisterSubscription?: (record: PaymentRecordWithApp) => void;
  t: ReturnType<typeof useTranslations>;
}

export function usePaymentTableColumns({
  apps,
  subscriptions,
  isPending,
  onMatchUpdate,
  onLinkSubscription,
  onRegisterApp,
  onRegisterSubscription,
  t,
}: UsePaymentTableColumnsProps): DataTableColumn<PaymentRecordWithApp>[] {
  const statusLabels = getStatusLabels(t);

  return useMemo(
    () => [
      {
        id: "source",
        header: t("payments.table.columns.source"),
        headerClassName: "w-16",
        cell: (record) => (
          <Badge variant={record.source === "card" ? "info" : "secondary"}>
            {record.source === "card"
              ? t("payments.table.source.card")
              : t("payments.table.source.csv")}
          </Badge>
        ),
      },
      {
        id: "transactionDate",
        header: t("payments.table.columns.transactionDate"),
        sortable: true,
        cell: (record) => (
          <span className="whitespace-nowrap tabular-nums">
            {formatDate(record.transactionDate)}
          </span>
        ),
      },
      {
        id: "merchantName",
        header: t("payments.table.columns.merchantName"),
        sortable: true,
        cell: (record) => (
          <div className="max-w-[200px] min-w-0">
            <div
              className="text-foreground truncate font-medium"
              title={record.merchantName}
            >
              {record.merchantName}
            </div>
            {record.cardLast4 && (
              <div className="text-muted-foreground truncate text-xs tabular-nums">
                {t("payments.table.cardLast4")}
                {record.cardLast4}
              </div>
            )}
          </div>
        ),
      },
      {
        id: "amount",
        header: t("payments.table.columns.amount"),
        sortable: true,
        className: "text-right font-medium whitespace-nowrap tabular-nums",
        headerClassName: "text-right",
        cell: (record) => formatAmount(record.amount, record.currency),
      },
      {
        id: "matchStatus",
        header: t("payments.table.columns.matchStatus"),
        cell: (record) => (
          <div className="flex items-center gap-1 whitespace-nowrap">
            <Badge
              variant="secondary"
              className={STATUS_COLORS[record.matchStatus]}
            >
              {statusLabels[record.matchStatus]}
            </Badge>
            {record.matchConfidence && (
              <span className="text-muted-foreground text-xs">
                ({Math.round(record.matchConfidence * 100)}%)
              </span>
            )}
          </div>
        ),
      },
      {
        id: "matchedApp",
        header: t("payments.table.columns.matchedApp"),
        cell: (record) => (
          <div className="flex items-center gap-1">
            <Select
              value={record.matchedApp?.id || "none"}
              onValueChange={(value) => {
                if (value === "__register_app__") {
                  onRegisterApp?.(record);
                  return;
                }
                onMatchUpdate(record.id, value === "none" ? null : value);
              }}
              disabled={isPending}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder={t("payments.table.appSelect")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__register_app__">
                  <span className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    {t("payments.table.registerNewApp")}
                  </span>
                </SelectItem>
                <SelectSeparator />
                <SelectItem value="none">
                  {t("payments.table.unmatched")}
                </SelectItem>
                {apps.map((app) => (
                  <SelectItem key={app.id} value={app.id}>
                    {app.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {record.matchedApp && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={() => onMatchUpdate(record.id, null)}
                disabled={isPending}
                title={t("payments.table.unmatch")}
              >
                <X className="text-error h-4 w-4" />
              </Button>
            )}
          </div>
        ),
      },
      {
        id: "linkedSubscription",
        header: t("payments.table.columns.linkedSubscription"),
        cell: (record) =>
          record.linkedSubscription ? (
            <div className="flex items-center gap-2">
              <Link2 className="text-success h-4 w-4 shrink-0" />
              <span
                className="max-w-[120px] truncate text-sm"
                title={record.linkedSubscription.appName}
              >
                {record.linkedSubscription.appName}
              </span>
            </div>
          ) : (
            <Select
              value="none"
              onValueChange={(value) => {
                if (value === "__register_subscription__") {
                  onRegisterSubscription?.(record);
                  return;
                }
                onLinkSubscription(record.id, value);
              }}
              disabled={isPending}
            >
              <SelectTrigger className="w-36">
                <SelectValue
                  placeholder={t("payments.table.subscriptionLink")}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__register_subscription__">
                  <span className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    {t("payments.table.registerNewSubscription")}
                  </span>
                </SelectItem>
                <SelectSeparator />
                <SelectItem value="none">
                  {t("payments.table.unlinked")}
                </SelectItem>
                {subscriptions.map((sub) => (
                  <SelectItem key={sub.id} value={sub.id}>
                    {sub.appName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ),
      },
    ],
    [
      apps,
      subscriptions,
      isPending,
      onMatchUpdate,
      onLinkSubscription,
      onRegisterApp,
      onRegisterSubscription,
      t,
      statusLabels,
    ]
  );
}
