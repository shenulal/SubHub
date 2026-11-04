// src/components/receipts/link-subscription-dialog.tsx
"use client";

import {
  getLinkableSubscriptions,
  linkReceiptSuggestion,
} from "@/actions/receipts";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type {
  LinkableSubscriptionDTO,
  ReceiptSuggestionDTO,
} from "@/types/receipts";
import { Check, Loader2, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { formatMoney } from "./receipts.utils";

interface LinkSubscriptionDialogProps {
  suggestion: ReceiptSuggestionDTO | null;
  onClose: () => void;
  onLinked: () => void;
}

const SEARCH_DEBOUNCE_MS = 250;

export function LinkSubscriptionDialog({
  suggestion,
  onClose,
  onLinked,
}: LinkSubscriptionDialogProps) {
  const t = useTranslations("receipts");
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<LinkableSubscriptionDTO[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [updateAmount, setUpdateAmount] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!suggestion) return;
    setSearch(suggestion.matchedSubscription?.appName ?? suggestion.vendorName);
    setSelectedId(suggestion.matchedSubscription?.id ?? null);
    setError(null);
  }, [suggestion]);

  useEffect(() => {
    if (!suggestion) return;
    setLoading(true);
    const handle = setTimeout(() => {
      getLinkableSubscriptions(search)
        .then((res) => setOptions(res.success && res.data ? res.data : []))
        .finally(() => setLoading(false));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [search, suggestion]);

  if (!suggestion) return null;

  const submit = () => {
    if (!selectedId) return;
    startTransition(async () => {
      const result = await linkReceiptSuggestion(suggestion.id, {
        subscriptionId: selectedId,
        updateLastDetectedAmount: updateAmount,
      });
      if (!result.success) {
        setError(result.error ?? t("common.errors.generic"));
        return;
      }
      onLinked();
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("queue.link.title")}</DialogTitle>
          <DialogDescription>{t("queue.link.description")}</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search
            className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("queue.link.search")}
            className="pl-8"
            aria-label={t("queue.link.search")}
          />
        </div>

        <ul
          className="border-border/60 max-h-64 divide-y overflow-y-auto rounded-md border"
          role="listbox"
        >
          {loading && options.length === 0 && (
            <li className="text-muted-foreground p-3 text-sm">
              {t("common.loading")}
            </li>
          )}
          {!loading && options.length === 0 && (
            <li className="text-muted-foreground p-3 text-sm">
              {t("queue.link.noResults")}
            </li>
          )}
          {options.map((o) => {
            const active = o.id === selectedId;
            return (
              <li key={o.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => setSelectedId(o.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors",
                    active
                      ? "bg-primary/10 text-foreground"
                      : "hover:bg-muted/60"
                  )}
                >
                  <span className="truncate font-medium">{o.appName}</span>
                  <span className="text-muted-foreground flex items-center gap-2 text-xs tabular-nums">
                    {formatMoney(o.amount, o.currency)} ·{" "}
                    {t(`common.cycles.${o.billingCycle}`)}
                    {active && (
                      <Check className="text-primary h-4 w-4" aria-hidden />
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {suggestion.amount !== null && (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={updateAmount}
              onCheckedChange={(v) => setUpdateAmount(v === true)}
            />
            {t("queue.link.updateAmount")}
          </label>
        )}
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            {t("common.actions.cancel")}
          </Button>
          <Button onClick={submit} disabled={!selectedId || isPending}>
            {isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            )}
            {isPending ? t("queue.link.submitting") : t("queue.link.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
