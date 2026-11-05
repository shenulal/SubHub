// src/components/receipts/mailboxes-settings-client.tsx
"use client";

import {
  disconnectMailbox,
  getMailboxes,
  scanMailboxNow,
} from "@/actions/receipts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type {
  MailboxConnectionDTO,
  MailboxProviderAvailability,
  MailboxProviderId,
} from "@/types/receipts";
import { Lock, Mail, ScanSearch, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { MailboxCard } from "./mailbox-card";

interface MailboxesSettingsClientProps {
  initialMailboxes: MailboxConnectionDTO[];
  availability: MailboxProviderAvailability;
  canManageAll: boolean;
}

const CONNECT_PROVIDERS: Array<{
  id: MailboxProviderId;
  key: "gmail" | "outlook";
}> = [
  { id: "GMAIL", key: "gmail" },
  { id: "OUTLOOK", key: "outlook" },
];

const CALLBACK_ERRORS = [
  "denied",
  "invalid_state",
  "session_mismatch",
  "missing_code",
  "exchange_failed",
] as const;

export function MailboxesSettingsClient({
  initialMailboxes,
  availability,
  canManageAll,
}: MailboxesSettingsClientProps) {
  const t = useTranslations("receipts");
  const router = useRouter();
  const params = useSearchParams();
  const [mailboxes, setMailboxes] = useState(initialMailboxes);
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [pendingDisconnect, setPendingDisconnect] =
    useState<MailboxConnectionDTO | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const connected = params.get("connected");
    const error = params.get("error");
    if (connected) toast.success(t("mailboxes.connect.connected"));
    if (error && (CALLBACK_ERRORS as readonly string[]).includes(error)) {
      toast.error(
        t(
          `mailboxes.connect.errors.${error as (typeof CALLBACK_ERRORS)[number]}`
        )
      );
    }
    if (connected || error) router.replace("/settings/mailboxes");
  }, [params, router, t]);

  const refresh = async () => {
    const result = await getMailboxes();
    if (result.success && result.data) setMailboxes(result.data);
  };

  const scan = (id: string) => {
    setScanningId(id);
    startTransition(async () => {
      const result = await scanMailboxNow(id);
      if (result.success && result.data) {
        toast.success(
          t("mailboxes.toasts.scanned", {
            fetched: result.data.fetched,
            created: result.data.created,
          })
        );
      } else {
        toast.error(
          t("mailboxes.toasts.scanFailed", { error: result.error ?? "" })
        );
      }
      await refresh();
      setScanningId(null);
    });
  };

  const disconnect = () => {
    const target = pendingDisconnect;
    setPendingDisconnect(null);
    if (!target) return;
    startTransition(async () => {
      const result = await disconnectMailbox(target.id);
      if (result.success) toast.success(t("mailboxes.toasts.disconnected"));
      else toast.error(result.error ?? t("common.errors.generic"));
      await refresh();
    });
  };

  const own = mailboxes.filter((m) => m.isOwn);
  const others = mailboxes.filter((m) => !m.isOwn);

  return (
    <div className="space-y-8">
      <header>
        <h3 className="text-lg font-medium">{t("mailboxes.title")}</h3>
        <p className="text-muted-foreground max-w-2xl text-sm">
          {t("mailboxes.subtitle")}
        </p>
      </header>

      <section
        aria-labelledby="connect-heading"
        className="border-border/60 from-primary/5 dark:from-primary/10 rounded-xl border bg-gradient-to-br via-transparent to-transparent p-5"
      >
        <h4
          id="connect-heading"
          className="mb-3 flex items-center gap-2 font-medium"
        >
          <Sparkles className="text-primary h-4 w-4" aria-hidden />
          {t("mailboxes.connect.heading")}
        </h4>
        <div className="flex flex-wrap gap-3">
          {CONNECT_PROVIDERS.map(({ id, key }) => {
            const enabled = availability[key];
            const button = (
              <Button
                asChild={enabled}
                disabled={!enabled}
                variant={key === "gmail" ? "default" : "secondary"}
                key={id}
              >
                {enabled ? (
                  <a href={`/api/integrations/mailbox/${key}/connect`}>
                    <Mail className="mr-2 h-4 w-4" aria-hidden />
                    {t(`mailboxes.connect.${key}`)}
                  </a>
                ) : (
                  <span>
                    <Mail className="mr-2 h-4 w-4" aria-hidden />
                    {t(`mailboxes.connect.${key}`)}
                  </span>
                )}
              </Button>
            );
            return (
              <div key={id} className="space-y-1">
                {button}
                {!enabled && (
                  <p className="text-muted-foreground max-w-[240px] text-xs leading-snug">
                    {t("mailboxes.connect.notConfigured", {
                      provider: t(`common.providers.${id}`),
                    })}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <MailboxList
        title={t("mailboxes.list.own")}
        items={own}
        scanningId={scanningId}
        onScan={scan}
        onDisconnect={setPendingDisconnect}
        emptyText={t("mailboxes.list.empty")}
      />

      {canManageAll && others.length > 0 && (
        <MailboxList
          title={t("mailboxes.list.all")}
          items={others}
          scanningId={scanningId}
          onScan={scan}
          onDisconnect={setPendingDisconnect}
          showOwner
        />
      )}

      <section
        aria-labelledby="privacy-heading"
        className="border-border/60 rounded-xl border border-dashed p-5"
      >
        <h4
          id="privacy-heading"
          className="mb-2 flex items-center gap-2 font-medium"
        >
          <Lock className="h-4 w-4" aria-hidden />
          {t("mailboxes.privacy.title")}
        </h4>
        <ul className="text-muted-foreground grid gap-2 text-sm sm:grid-cols-2">
          {(["readOnly", "receiptsOnly", "snippets", "encrypted"] as const).map(
            (k) => (
              <li key={k} className="flex gap-2">
                <ScanSearch
                  className="text-primary/70 mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden
                />
                <span>{t(`mailboxes.privacy.${k}`)}</span>
              </li>
            )
          )}
        </ul>
      </section>

      <AlertDialog
        open={pendingDisconnect !== null}
        onOpenChange={(open) => !open && setPendingDisconnect(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("mailboxes.list.disconnectConfirmTitle", {
                email: pendingDisconnect?.email ?? "",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("mailboxes.list.disconnectConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={disconnect}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("mailboxes.list.disconnect")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MailboxList({
  title,
  items,
  scanningId,
  onScan,
  onDisconnect,
  emptyText,
  showOwner,
}: {
  title: string;
  items: MailboxConnectionDTO[];
  scanningId: string | null;
  onScan: (id: string) => void;
  onDisconnect: (m: MailboxConnectionDTO) => void;
  emptyText?: string;
  showOwner?: boolean;
}) {
  return (
    <section className="space-y-3">
      <h4 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
        {title}
      </h4>
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">{emptyText}</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {items.map((m) => (
            <MailboxCard
              key={m.id}
              mailbox={m}
              scanning={scanningId === m.id}
              onScan={() => onScan(m.id)}
              onDisconnect={() => onDisconnect(m)}
              showOwner={showOwner}
            />
          ))}
        </div>
      )}
    </section>
  );
}
