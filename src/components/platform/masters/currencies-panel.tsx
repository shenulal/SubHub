"use client";

import {
  addManualRate,
  refreshRatesNow,
  setCurrencyEnabled,
} from "@/actions/platform/masters/currencies";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { CurrencyRow } from "@/types/platform";
import { AlertTriangle, Loader2, PencilLine, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Field, PanelHeader } from "./master-shared";

interface CurrenciesPanelProps {
  rows: CurrencyRow[];
  canManage: boolean;
}

const RATE_PRECISION = 6;

function formatRate(rate: number | null): string {
  return rate === null
    ? "—"
    : rate.toLocaleString(undefined, { maximumFractionDigits: RATE_PRECISION });
}

function ManualRateDialog({
  base,
  codes,
  onSaved,
}: {
  base: string;
  codes: string[];
  onSaved: () => void;
}) {
  const t = useTranslations("platform.masters.currencies");
  const tc = useTranslations("platform.masters.common");
  const [open, setOpen] = useState(false);
  const [quote, setQuote] = useState(codes[0] ?? "");
  const [rate, setRate] = useState("");
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => {
      const result = await addManualRate({
        baseCurrency: base,
        quoteCurrency: quote,
        rate,
      });
      if (result.success) {
        toast.success(t("rateSaved"));
        setOpen(false);
        setRate("");
        onSaved();
      } else {
        toast.error(result.error ?? tc("saveFailed"));
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <PencilLine className="size-4" />
          {t("manualRate")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("manualRateTitle")}</DialogTitle>
          <DialogDescription>
            {t("manualRateDescription", { base })}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="manual-quote" label={t("quoteCurrency")}>
            <Select value={quote} onValueChange={setQuote}>
              <SelectTrigger id="manual-quote">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {codes.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="manual-rate" label={t("rateLabel", { base, quote })}>
            <Input
              id="manual-rate"
              inputMode="decimal"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="3.6725"
              className="font-mono"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {tc("cancel")}
          </Button>
          <Button onClick={submit} disabled={isPending || !rate || !quote}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CurrenciesPanel({ rows, canManage }: CurrenciesPanelProps) {
  const t = useTranslations("platform.masters.currencies");
  const tc = useTranslations("platform.masters.common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const base = rows.find((r) => r.isBase)?.code ?? "";
  const staleCount = rows.filter(
    (r) => r.isEnabled && !r.isBase && (r.stale || r.rate === null)
  ).length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? rows.filter(
          (r) =>
            r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)
        )
      : rows;
    return [...list].sort(
      (a, b) =>
        Number(b.isBase) - Number(a.isBase) ||
        Number(b.isEnabled) - Number(a.isEnabled) ||
        a.code.localeCompare(b.code)
    );
  }, [rows, query]);

  const toggle = (code: string, enabled: boolean) => {
    startTransition(async () => {
      const result = await setCurrencyEnabled({ code, enabled });
      if (result.success) router.refresh();
      else toast.error(result.error ?? tc("saveFailed"));
    });
  };

  const refresh = () => {
    startTransition(async () => {
      const result = await refreshRatesNow();
      if (result.success && result.data) {
        toast.success(
          t("refreshed", {
            count: result.data.upserted,
            provider: result.data.provider,
          })
        );
        router.refresh();
      } else {
        toast.error(result.error ?? tc("saveFailed"));
      }
    });
  };

  return (
    <div>
      <PanelHeader
        title={t("title")}
        description={t("description", { base })}
        action={
          canManage && (
            <div className="flex flex-wrap gap-2">
              <ManualRateDialog
                base={base}
                codes={rows.filter((r) => !r.isBase).map((r) => r.code)}
                onSaved={() => router.refresh()}
              />
              <Button size="sm" onClick={refresh} disabled={isPending}>
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                {t("refreshNow")}
              </Button>
            </div>
          )
        }
      />
      {staleCount > 0 && (
        <div className="tonal-warning mb-4 flex items-center gap-2 rounded-md px-4 py-3 text-[0.9375rem]">
          <AlertTriangle className="size-5 shrink-0" />
          <span className="min-w-0">
            {t("staleWarning", { count: staleCount })}
          </span>
        </div>
      )}
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("search")}
        className="mb-4 w-full sm:max-w-xs"
      />
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-24">{tc("code")}</TableHead>
              <TableHead>{tc("name")}</TableHead>
              <TableHead className="text-right">
                {t("rateColumn", { base })}
              </TableHead>
              <TableHead>{t("asOf")}</TableHead>
              <TableHead className="w-28 text-right">{t("enabled")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((row) => (
              <TableRow
                key={row.code}
                className={cn(!row.isEnabled && "text-muted-foreground")}
              >
                <TableCell className="font-mono font-medium whitespace-nowrap">
                  {row.code}
                  {row.isBase && (
                    <span className="tonal-primary ml-2 rounded px-1.5 py-0.5 font-sans text-[10px] font-medium uppercase">
                      {t("base")}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <span>{row.name}</span>
                  <span className="text-muted-foreground ml-2 text-xs">
                    {row.symbol}
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {row.isBase ? "1" : formatRate(row.rate)}
                </TableCell>
                <TableCell className="text-[0.8125rem] whitespace-nowrap">
                  {row.isBase ? (
                    "—"
                  ) : row.rateAsOf ? (
                    <span className={cn(row.stale && "text-warning")}>
                      {new Date(row.rateAsOf).toLocaleDateString()} ·{" "}
                      {row.rateSource}
                    </span>
                  ) : (
                    <span className="text-warning">{t("noRate")}</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Switch
                    checked={row.isEnabled}
                    disabled={!canManage || row.isBase || isPending}
                    onCheckedChange={(v) => toggle(row.code, v)}
                    aria-label={`${row.code} ${t("enabled")}`}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
