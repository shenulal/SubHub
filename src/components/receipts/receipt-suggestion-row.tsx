// src/components/receipts/receipt-suggestion-row.tsx
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ReceiptSuggestionDTO } from "@/types/receipts";
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Link2,
  Sparkles,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ConfidenceMeter } from "./confidence-meter";
import {
  formatDate,
  formatMoney,
  hasPriceDrift,
  isOpenStatus,
  vendorInitials,
} from "./receipts.utils";

interface ReceiptSuggestionRowProps {
  suggestion: ReceiptSuggestionDTO;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onAccept: () => void;
  onLink: () => void;
  onDismiss: () => void;
  canCreate: boolean;
  busy: boolean;
}

export function ReceiptSuggestionRow({
  suggestion: s,
  selected,
  onSelect,
  onAccept,
  onLink,
  onDismiss,
  canCreate,
  busy,
}: ReceiptSuggestionRowProps) {
  const t = useTranslations("receipts");
  const [open, setOpen] = useState(false);
  const money = formatMoney(s.amount, s.currency);
  const drift = hasPriceDrift(s.amount, s.currency, s.matchedSubscription);
  const isOpen = isOpenStatus(s.status);

  return (
    <>
      <TableRow
        data-state={selected ? "selected" : undefined}
        className={cn(
          "group border-border/60 align-top transition-colors",
          selected && "bg-primary/5 dark:bg-primary/10"
        )}
      >
        <TableCell className="w-10 pt-4">
          {isOpen && (
            <Checkbox
              checked={selected}
              onCheckedChange={(v) => onSelect(v === true)}
              aria-label={s.vendorName}
            />
          )}
        </TableCell>

        <TableCell className="min-w-[220px]">
          <div className="flex items-start gap-3">
            <Avatar className="border-border/60 mt-0.5 h-9 w-9 rounded-lg border">
              {s.matchedCatalog?.logoUrl && (
                <AvatarImage src={s.matchedCatalog.logoUrl} alt="" />
              )}
              <AvatarFallback className="bg-muted rounded-lg text-xs font-semibold">
                {vendorInitials(s.vendorName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="truncate font-medium">{s.vendorName}</span>
                {s.matchedCatalog && (
                  <Badge
                    variant="outline"
                    className="h-5 gap-1 px-1.5 text-[10px] font-medium"
                  >
                    <Sparkles className="h-3 w-3" aria-hidden />
                    {t("queue.badges.catalog")}
                  </Badge>
                )}
              </div>
              <p
                className="text-muted-foreground truncate text-xs"
                title={s.subject ?? undefined}
              >
                {s.subject}
              </p>
              <p className="text-muted-foreground/80 truncate text-[11px]">
                {s.senderEmail} ·{" "}
                {t("queue.snippet.via", { mailbox: s.mailboxEmail })}
              </p>
            </div>
          </div>
        </TableCell>

        <TableCell className="whitespace-nowrap">
          {money ? (
            <span className="font-semibold tabular-nums">{money}</span>
          ) : (
            <span className="text-muted-foreground text-xs">
              {t("common.unknownAmount")}
            </span>
          )}
        </TableCell>

        <TableCell className="text-sm whitespace-nowrap">
          {s.billingCycle ? (
            t(`common.cycles.${s.billingCycle}`)
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
          {s.nextRenewalAt && (
            <p className="text-muted-foreground text-[11px]">
              → {formatDate(s.nextRenewalAt)}
            </p>
          )}
        </TableCell>

        <TableCell className="text-sm whitespace-nowrap tabular-nums">
          {formatDate(s.chargedAt) ?? (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>

        <TableCell>
          <ConfidenceMeter value={s.confidence} />
        </TableCell>

        <TableCell className="max-w-[200px]">
          <MatchBadges suggestion={s} drift={drift} />
        </TableCell>

        <TableCell className="text-right whitespace-nowrap">
          <div className="flex items-center justify-end gap-1">
            {isOpen && canCreate && (
              <Button
                size="sm"
                onClick={onAccept}
                disabled={busy}
                className="h-8"
              >
                <Check className="mr-1 h-3.5 w-3.5" aria-hidden />
                {t("common.actions.accept")}
              </Button>
            )}
            {isOpen && (
              <Button
                size="sm"
                variant="outline"
                onClick={onLink}
                disabled={busy}
                className="h-8"
              >
                <Link2 className="mr-1 h-3.5 w-3.5" aria-hidden />
                {t("common.actions.link")}
              </Button>
            )}
            {isOpen && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onDismiss}
                disabled={busy}
                className="text-muted-foreground hover:text-destructive h-8"
                aria-label={t("common.actions.dismiss")}
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={
                open ? t("queue.snippet.hide") : t("queue.snippet.show")
              }
            >
              {open ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {open && (
        <TableRow className="bg-muted/40 hover:bg-muted/40 dark:bg-muted/20">
          <TableCell />
          <TableCell colSpan={7} className="py-3">
            <div className="border-border/60 bg-background/70 rounded-md border p-3 text-sm shadow-sm">
              <dl className="text-muted-foreground mb-2 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                <div>
                  <dt className="inline font-medium">
                    {t("queue.snippet.subject")}:{" "}
                  </dt>
                  <dd className="inline">{s.subject ?? "—"}</dd>
                </div>
                <div>
                  <dd className="inline">
                    {t("queue.snippet.from", { email: s.senderEmail ?? "—" })}
                  </dd>
                </div>
              </dl>
              <p className="text-foreground/90 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                {s.snippet ?? "—"}
              </p>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function MatchBadges({
  suggestion: s,
  drift,
}: {
  suggestion: ReceiptSuggestionDTO;
  drift: boolean;
}) {
  const t = useTranslations("receipts.queue.badges");
  if (!s.matchedSubscription) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  const matchedMoney = formatMoney(
    s.matchedSubscription.amount,
    s.matchedSubscription.currency
  );
  return (
    <div className="flex flex-wrap gap-1">
      {s.status === "DUPLICATE" ? (
        <Badge className="gap-1 bg-sky-100 text-sky-800 hover:bg-sky-100 dark:bg-sky-900/40 dark:text-sky-200">
          <Copy className="h-3 w-3" aria-hidden />
          {t("duplicate", { name: s.matchedSubscription.appName })}
        </Badge>
      ) : (
        <Badge variant="secondary" className="gap-1">
          <Link2 className="h-3 w-3" aria-hidden />
          {t("matched", { name: s.matchedSubscription.appName })}
        </Badge>
      )}
      {drift && (
        <Badge className="gap-1 bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-200">
          <ArrowUpDown className="h-3 w-3" aria-hidden />
          {t("priceChange", { amount: matchedMoney ?? "" })}
        </Badge>
      )}
    </div>
  );
}
