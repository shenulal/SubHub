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
import { enUS, ko } from "date-fns/locale";
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
  "default" | "secondary" | "destructive" | "outline"
> = {
  ACTIVE: "default",
  EXPIRED: "destructive",
  CANCELLED: "outline",
  PENDING: "secondary",
};

function AppAvatar({ name, logo }: { name: string; logo: string | null }) {
  return logo ? (
    <Image
      src={logo}
      alt={name}
      width={24}
      height={24}
      className="rounded-sm"
    />
  ) : (
    <div className="bg-primary/10 text-primary flex h-6 w-6 items-center justify-center rounded-sm text-xs font-medium">
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
  const dateLocale = locale === "ko" ? ko : enUS;
  const dateFormat =
    locale === "ko" ? "yyyy년 M월 d일 (EEEE)" : "MMMM d, yyyy (EEEE)";
  const formattedDate = format(parseISO(date), dateFormat, {
    locale: dateLocale,
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
    <Card className="border-border/50 rounded-sm shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle>{formattedDate}</CardTitle>
          {renewals.length > 0 && (
            <p className="text-muted-foreground mt-1 text-sm">
              {t("subscriptions.renewalDay.summary", {
                count: renewals.length,
                amount: formatMoney(totalAmount, primaryCurrency, locale),
              })}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label={td("close")}
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isEmpty && (
          <p className="text-muted-foreground py-8 text-center">
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
                    <div className="flex items-center gap-2">
                      <AppAvatar
                        name={renewal.appName}
                        logo={renewal.appLogo}
                      />
                      <span className="font-medium">{renewal.appName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatMoney(renewal.amount, renewal.currency, locale)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariants[renewal.status]}>
                      {statusLabels[renewal.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" asChild>
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
                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
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
                  className="font-medium hover:underline"
                >
                  {m.appName}
                </Link>
                <span
                  className={cn(
                    "ml-auto text-xs font-medium",
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
