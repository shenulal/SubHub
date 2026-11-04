// src/components/receipts/mailbox-card.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MailboxConnectionDTO } from "@/types/receipts";
import {
  AlertTriangle,
  Loader2,
  Mail,
  RefreshCw,
  ShieldOff,
  Unplug,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { formatRelative } from "./receipts.utils";

interface MailboxCardProps {
  mailbox: MailboxConnectionDTO;
  onScan: () => void;
  onDisconnect: () => void;
  scanning: boolean;
  showOwner?: boolean;
}

const STATUS_STYLES: Record<MailboxConnectionDTO["status"], string> = {
  ACTIVE:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  ERROR: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  REVOKED: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
};

const PROVIDER_STYLES: Record<MailboxConnectionDTO["provider"], string> = {
  GMAIL: "from-red-500/15 to-amber-400/15 text-red-600 dark:text-red-300",
  OUTLOOK: "from-sky-500/15 to-blue-600/15 text-sky-700 dark:text-sky-300",
};

export function MailboxCard({
  mailbox: m,
  onScan,
  onDisconnect,
  scanning,
  showOwner,
}: MailboxCardProps) {
  const t = useTranslations("receipts");
  const canScan = m.status !== "REVOKED" && !scanning;
  const lastScan = formatRelative(m.lastScannedAt);

  return (
    <article
      className="border-border/60 bg-card hover:border-border group relative overflow-hidden rounded-xl border p-4 shadow-sm transition-shadow hover:shadow-md"
      data-status={m.status}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br",
            PROVIDER_STYLES[m.provider]
          )}
        >
          <Mail className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-medium">{m.email}</h3>
            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
              {t(`common.providers.${m.provider}`)}
            </Badge>
            <Badge
              className={cn(
                "h-5 gap-1 px-1.5 text-[10px] hover:bg-inherit",
                STATUS_STYLES[m.status]
              )}
            >
              {m.status === "ERROR" && (
                <AlertTriangle className="h-3 w-3" aria-hidden />
              )}
              {m.status === "REVOKED" && (
                <ShieldOff className="h-3 w-3" aria-hidden />
              )}
              {t(`mailboxes.list.status.${m.status}`)}
            </Badge>
          </div>
          <dl className="text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
            {showOwner && (
              <div>
                <dt className="inline">{t("mailboxes.list.owner")}: </dt>
                <dd className="inline">{m.ownerName ?? m.ownerEmail ?? "—"}</dd>
              </div>
            )}
            <div>
              <dt className="inline">{t("mailboxes.list.lastScan")}: </dt>
              <dd className="inline" title={m.lastScannedAt ?? undefined}>
                {lastScan ?? t("common.never")}
              </dd>
            </div>
            <div>
              <dd className="inline">
                <Link
                  href="/subscriptions/receipts"
                  className="hover:text-foreground underline-offset-2 hover:underline"
                >
                  {t("mailboxes.list.suggestions", {
                    count: m.suggestionCount,
                  })}
                </Link>
                {m.newSuggestionCount > 0 && (
                  <span className="text-primary ml-1 font-medium">
                    ·{" "}
                    {t("mailboxes.list.newSuggestions", {
                      count: m.newSuggestionCount,
                    })}
                  </span>
                )}
              </dd>
            </div>
          </dl>
          {m.errorMessage && m.status !== "ACTIVE" && (
            <p
              className="text-destructive/90 mt-2 line-clamp-2 text-xs"
              title={m.errorMessage}
            >
              {m.errorMessage}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {m.status === "REVOKED" ? (
          <Button asChild size="sm" variant="outline">
            <a
              href={`/api/integrations/mailbox/${m.provider.toLowerCase()}/connect`}
            >
              {t("mailboxes.list.reconnect")}
            </a>
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={onScan}
            disabled={!canScan}
          >
            {scanning ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="mr-1 h-3.5 w-3.5" aria-hidden />
            )}
            {scanning
              ? t("mailboxes.list.scanning")
              : t("mailboxes.list.scanNow")}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground hover:text-destructive"
          onClick={onDisconnect}
          disabled={scanning}
        >
          <Unplug className="mr-1 h-3.5 w-3.5" aria-hidden />
          {t("mailboxes.list.disconnect")}
        </Button>
      </div>
    </article>
  );
}
