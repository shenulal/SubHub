// src/components/subscriptions/renewal-day-detail.tsx
"use client";

/**
 * Detail panel for a calendar day: renewals plus trial-end / notice markers.
 */
import type { RenewalItem } from "@/actions/subscriptions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/services/discovery/money";
import { cn } from "@/lib/utils";
import type { CalendarMarker } from "@/types/discovery";
import { format, parseISO } from "date-fns";
import { enUS } from "date-fns/locale";
import { ExternalLink, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";

import { MARKER_STYLES } from "./renewal-calendar";

interface RenewalDayDetailProps {
  date: string; // YYYY-MM-DD
  renewals: RenewalItem[];
  markers?: CalendarMarker[];
  onClose: () => void;
}

const statusVariants: Record<
  RenewalItem["status"],
  "success" | "secondary" | "warning" | "outline"
> = {
  ACTIVE: "success",
  EXPIRED: "outline",
  CANCELLED: "secondary",
  PENDING: "warning",
};

function AppAvatar({ name, logo }: { name: string; logo: string | null }) {
  return logo ? (
    <Image
      src={logo}
      alt={name}
      width={24}
      height={24}
      className="size-7 shrink-0 rounded-md border object-contain"
    />
  ) : (
    <div className="tonal-primary flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-medium">
      {name.charAt(0)}
    </div>
  );
}

export function RenewalDayDetail({
  date,
  renewals,
  markers = [],
  onClose,
}: RenewalDayDetailProps) {
  const t = useTranslations();
  const td = useTranslations("discovery.calendar");
  const locale = useLocale();
  const formattedDate = format(parseISO(date), "MMMM d, yyyy (EEEE)", {
    locale: enUS,
  });

  const statusLabels: Record<RenewalItem["status"], string> = {
    ACTIVE: t("subscriptions.status.active"),
    EXPIRED: t("subscriptions.status.expired"),
    CANCELLED: t("subscriptions.status.cancelled"),
    PENDING: t("subscriptions.status.pending"),
  };

  const totalAmount = renewals.reduce((sum, item) => sum + item.amount, 0);
  const primaryCurrency = renewals[0]?.currency ?? "";
  const isEmpty = renewals.length === 0 && markers.length === 0;

  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="min-w-0">
          <CardTitle className="truncate" title={formattedDate}>
            {formattedDate}
          </CardTitle>
          {renewals.length > 0 && (
            <p className="text-muted-foreground mt-1 text-[0.8125rem] tabular-nums">
              {t("subscriptions.renewalDay.summary", {
                count: renewals.length,
                amount: formatMoney(totalAmount, primaryCurrency, locale),
              })}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground -mt-1 -mr-2 shrink-0"
          onClick={onClose}
          aria-label={td("close")}
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isEmpty && (
          <p className="text-muted-foreground py-8 text-center text-[0.9375rem]">
            {t("subscriptions.renewalDay.empty")}
          </p>
        )}

        {renewals.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("subscriptions.renewalDay.table.app")}</TableHead>
                <TableHead>
                  {t("subscriptions.renewalDay.table.amount")}
                </TableHead>
                <TableHead>
                  {t("subscriptions.renewalDay.table.status")}
                </TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {renewals.map((renewal) => (
                <TableRow key={renewal.subscriptionId}>
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-2">
                      <AppAvatar
                        name={renewal.appName}
                        logo={renewal.appLogo}
                      />
                      <span
                        className="max-w-[9rem] truncate font-medium"
                        title={renewal.appName}
                      >
                        {renewal.appName}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {formatMoney(renewal.amount, renewal.currency, locale)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={statusVariants[renewal.status]}
                      className={cn(
                        renewal.status === "EXPIRED" &&
                          "bg-error/15 text-error border-transparent"
                      )}
                    >
                      {statusLabels[renewal.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-primary"
                      asChild
                    >
                      <Link href={`/subscriptions/${renewal.subscriptionId}`}>
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {markers.length > 0 && (
          <ul className="space-y-2" data-testid="day-markers">
            {markers.map((m) => (
              <li
                key={`${m.kind}-${m.subscriptionId}`}
                className="bg-muted/60 flex min-w-0 items-center gap-2 rounded-md px-3 py-2 text-[0.9375rem]"
              >
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    MARKER_STYLES[m.kind].dot
                  )}
                />
                <AppAvatar name={m.appName} logo={m.appLogoUrl} />
                <Link
                  href={`/subscriptions/${m.subscriptionId}`}
                  className="hover:text-primary min-w-0 truncate font-medium"
                  title={m.appName}
                >
                  {m.appName}
                </Link>
                <span
                  className={cn(
                    "ml-auto shrink-0 text-xs font-medium whitespace-nowrap",
                    MARKER_STYLES[m.kind].label
                  )}
                >
                  {td(`markers.${m.kind}`)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
