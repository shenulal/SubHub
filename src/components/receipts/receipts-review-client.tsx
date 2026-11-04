// src/components/receipts/receipts-review-client.tsx
"use client";

import {
  dismissReceiptSuggestions,
  getReceiptSuggestions,
  type ReceiptSuggestionPage,
} from "@/actions/receipts";
import { TabFilter } from "@/components/common/tab-filter";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  MailboxConnectionDTO,
  ReceiptSuggestionDTO,
} from "@/types/receipts";
import type { ReceiptSuggestionStatus } from "@prisma/client";
import { Inbox, Loader2, Search, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import {
  AcceptSuggestionDialog,
  type CategoryOption,
} from "./accept-suggestion-dialog";
import { LinkSubscriptionDialog } from "./link-subscription-dialog";
import { ReceiptSuggestionRow } from "./receipt-suggestion-row";
import { isOpenStatus, QUEUE_TABS } from "./receipts.utils";

interface ReceiptsReviewClientProps {
  initialPage: ReceiptSuggestionPage;
  mailboxes: MailboxConnectionDTO[];
  currencies: string[];
  categories: CategoryOption[];
  canCreate: boolean;
}

const ALL = "__all__";
const CONFIDENCE_FILTERS = [0.9, 0.8, 0.7, 0.6] as const;
const SEARCH_DEBOUNCE_MS = 300;

export function ReceiptsReviewClient({
  initialPage,
  mailboxes,
  currencies,
  categories,
  canCreate,
}: ReceiptsReviewClientProps) {
  const t = useTranslations("receipts");
  const [page, setPage] = useState(initialPage);
  const [status, setStatus] = useState<ReceiptSuggestionStatus>("NEW");
  const [search, setSearch] = useState("");
  const [mailboxId, setMailboxId] = useState(ALL);
  const [minConfidence, setMinConfidence] = useState(ALL);
  const [pageNo, setPageNo] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [accepting, setAccepting] = useState<ReceiptSuggestionDTO | null>(null);
  const [linking, setLinking] = useState<ReceiptSuggestionDTO | null>(null);
  const [isPending, startTransition] = useTransition();
  const [initial, setInitial] = useState(true);

  const load = useCallback(() => {
    startTransition(async () => {
      const result = await getReceiptSuggestions({
        status,
        search: search || undefined,
        mailboxId: mailboxId === ALL ? undefined : mailboxId,
        minConfidence:
          minConfidence === ALL ? undefined : Number(minConfidence),
        page: pageNo,
        limit: initialPage.limit,
      });
      if (result.success && result.data) {
        setPage(result.data);
        setSelected(new Set());
      } else if (result.error) {
        toast.error(t("queue.toasts.failed", { error: result.error }));
      }
    });
  }, [status, search, mailboxId, minConfidence, pageNo, initialPage.limit, t]);

  useEffect(() => {
    if (initial) {
      setInitial(false);
      return;
    }
    const handle = setTimeout(load, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const hasFilters =
    search !== "" || mailboxId !== ALL || minConfidence !== ALL;
  const openItems = useMemo(
    () => page.items.filter((i) => isOpenStatus(i.status)),
    [page.items]
  );
  const allSelected =
    openItems.length > 0 && openItems.every((i) => selected.has(i.id));

  const toggleAll = (checked: boolean) =>
    setSelected(checked ? new Set(openItems.map((i) => i.id)) : new Set());

  const dismiss = (ids: string[]) =>
    startTransition(async () => {
      const result = await dismissReceiptSuggestions(ids);
      if (result.success) {
        toast.success(
          t("queue.toasts.dismissed", {
            count: result.data?.count ?? ids.length,
          })
        );
        load();
      } else {
        toast.error(t("queue.toasts.failed", { error: result.error ?? "" }));
      }
    });

  const tabs = QUEUE_TABS.map((s) => ({
    value: s,
    label: t(`queue.tabs.${s}`),
    count: page.counts[s],
    variant: s === "NEW" ? ("default" as const) : ("secondary" as const),
  }));

  const from = page.total === 0 ? 0 : (page.page - 1) * page.limit + 1;
  const to = Math.min(page.total, page.page * page.limit);

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">
          {t("queue.title")}
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          {t("queue.subtitle")}
        </p>
      </header>

      <TabFilter
        items={tabs}
        value={status}
        onChange={(v) => {
          setStatus(v);
          setPageNo(1);
        }}
      />

      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search
            className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPageNo(1);
            }}
            placeholder={t("queue.filters.search")}
            aria-label={t("queue.filters.search")}
            className="pl-8"
          />
        </div>
        <Select
          value={mailboxId}
          onValueChange={(v) => {
            setMailboxId(v);
            setPageNo(1);
          }}
        >
          <SelectTrigger
            className="md:w-56"
            aria-label={t("queue.filters.mailbox")}
          >
            <SelectValue placeholder={t("queue.filters.mailbox")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>
              {t("queue.filters.allMailboxes")}
            </SelectItem>
            {mailboxes.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={minConfidence}
          onValueChange={(v) => {
            setMinConfidence(v);
            setPageNo(1);
          }}
        >
          <SelectTrigger
            className="md:w-44"
            aria-label={t("queue.filters.minConfidence")}
          >
            <SelectValue placeholder={t("queue.filters.minConfidence")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>
              {t("queue.filters.anyConfidence")}
            </SelectItem>
            {CONFIDENCE_FILTERS.map((c) => (
              <SelectItem key={c} value={String(c)}>
                ≥ {Math.round(c * 100)}%
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setMailboxId(ALL);
              setMinConfidence(ALL);
              setPageNo(1);
            }}
          >
            <X className="mr-1 h-4 w-4" aria-hidden />
            {t("queue.filters.clear")}
          </Button>
        )}
      </div>

      {selected.size > 0 && (
        <div className="bg-primary/5 border-primary/20 dark:bg-primary/10 flex items-center justify-between rounded-md border px-3 py-2 text-sm">
          <span className="font-medium">
            {t("queue.bulk.selected", { count: selected.size })}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected(new Set())}
            >
              {t("queue.bulk.clear")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => dismiss(Array.from(selected))}
              disabled={isPending}
            >
              <Trash2 className="mr-1 h-4 w-4" aria-hidden />
              {t("queue.bulk.dismissSelected")}
            </Button>
          </div>
        </div>
      )}

      <div className="border-border/60 relative overflow-x-auto rounded-lg border">
        {isPending && (
          <div className="bg-background/60 absolute inset-0 z-10 flex items-center justify-center backdrop-blur-[1px]">
            <Loader2
              className="text-muted-foreground h-5 w-5 animate-spin"
              aria-label={t("common.loading")}
            />
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-10">
                {openItems.length > 0 && (
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(v) => toggleAll(v === true)}
                    aria-label={t("queue.bulk.selectAll")}
                  />
                )}
              </TableHead>
              <TableHead>{t("queue.columns.vendor")}</TableHead>
              <TableHead>{t("queue.columns.amount")}</TableHead>
              <TableHead>{t("queue.columns.cycle")}</TableHead>
              <TableHead>{t("queue.columns.chargedAt")}</TableHead>
              <TableHead>{t("queue.columns.confidence")}</TableHead>
              <TableHead>{t("queue.columns.match")}</TableHead>
              <TableHead className="text-right">
                {t("queue.columns.actions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {page.items.map((s) => (
              <ReceiptSuggestionRow
                key={s.id}
                suggestion={s}
                selected={selected.has(s.id)}
                onSelect={(checked) =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (checked) next.add(s.id);
                    else next.delete(s.id);
                    return next;
                  })
                }
                onAccept={() => setAccepting(s)}
                onLink={() => setLinking(s)}
                onDismiss={() => dismiss([s.id])}
                canCreate={canCreate}
                busy={isPending}
              />
            ))}
          </TableBody>
        </Table>
        {page.items.length === 0 && (
          <EmptyQueue
            hasFilters={hasFilters}
            hasMailboxes={mailboxes.length > 0}
          />
        )}
      </div>

      {page.total > page.limit && (
        <div className="text-muted-foreground flex items-center justify-between text-sm">
          <span>
            {t("queue.pagination.summary", { from, to, total: page.total })}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page.page <= 1 || isPending}
              onClick={() => setPageNo((p) => p - 1)}
            >
              {t("queue.pagination.previous")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={to >= page.total || isPending}
              onClick={() => setPageNo((p) => p + 1)}
            >
              {t("queue.pagination.next")}
            </Button>
          </div>
        </div>
      )}

      <AcceptSuggestionDialog
        suggestion={accepting}
        currencies={currencies}
        categories={categories}
        onClose={() => setAccepting(null)}
        onAccepted={(linked) => {
          toast.success(
            linked
              ? t("queue.toasts.acceptedLinked")
              : t("queue.toasts.accepted")
          );
          setAccepting(null);
          load();
        }}
      />
      <LinkSubscriptionDialog
        suggestion={linking}
        onClose={() => setLinking(null)}
        onLinked={() => {
          toast.success(t("queue.toasts.linked"));
          setLinking(null);
          load();
        }}
      />
    </div>
  );
}

function EmptyQueue({
  hasFilters,
  hasMailboxes,
}: {
  hasFilters: boolean;
  hasMailboxes: boolean;
}) {
  const t = useTranslations("receipts.queue.empty");
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <div className="bg-muted text-muted-foreground flex h-12 w-12 items-center justify-center rounded-full">
        <Inbox className="h-6 w-6" aria-hidden />
      </div>
      <p className="font-medium">{t("title")}</p>
      <p className="text-muted-foreground max-w-sm text-sm">
        {hasFilters
          ? t("filtered")
          : hasMailboxes
            ? t("description")
            : t("noMailboxes")}
      </p>
      {!hasMailboxes && (
        <Button asChild size="sm" variant="outline" className="mt-2">
          <Link href="/settings/mailboxes">{t("connectCta")}</Link>
        </Button>
      )}
    </div>
  );
}
