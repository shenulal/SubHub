"use client";

/**
 * Master data → Vendor catalog: searchable, paginated list of the platform-wide
 * SaaS catalog with create / edit / (de)activate for `catalog:manage`.
 */
import {
  listCatalogEntries,
  setCatalogEntryActive,
  type CatalogPage,
} from "@/actions/taxonomy/catalog-admin";
import { Button } from "@/components/ui/button";
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
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { MasterOption } from "@/types/platform";
import type { CatalogItemDto } from "@/types/taxonomy";
import { ChevronLeft, ChevronRight, Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { CatalogEntryDialog } from "./catalog-entry-dialog";
import { ActiveToggleButton, PanelHeader, StatusBadge } from "./master-shared";

export interface VendorCatalogPanelProps {
  initial: CatalogPage;
  currencyCodes: string[];
  countries: MasterOption[];
  canManage: boolean;
  canManageGlobal: boolean;
  /** Debounce for the search box, from `discovery.searchDebounceMs`. */
  searchDebounceMs: number;
}

type Status = "all" | "active" | "inactive";
type DialogState = { entry: CatalogItemDto | null } | null;
const STATUSES: Status[] = ["all", "active", "inactive"];

function priceLabel(row: CatalogItemDto): string {
  if (row.basePricePerSeat === null) return "—";
  return `${row.basePricePerSeat.toLocaleString()} ${row.basePriceCurrency ?? ""}`.trim();
}

export function VendorCatalogPanel({
  initial,
  currencyCodes,
  countries,
  canManage,
  canManageGlobal,
  searchDebounceMs,
}: VendorCatalogPanelProps) {
  const t = useTranslations("platform.masters.catalog");
  const tc = useTranslations("platform.masters.common");
  const [data, setData] = useState<CatalogPage>(initial);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [isPending, startTransition] = useTransition();
  const firstRun = useRef(true);

  const load = (next: { query: string; status: Status; page: number }) => {
    startTransition(async () => {
      const result = await listCatalogEntries(next);
      if (result.success && result.data) setData(result.data);
      else toast.error(result.error ?? tc("saveFailed"));
    });
  };

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const handle = setTimeout(
      () => load({ query, status, page }),
      searchDebounceMs
    );
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load is stable in intent
  }, [query, status, page, searchDebounceMs]);

  const reload = () => load({ query, status, page });
  const setActive = (id: string, isActive: boolean) => {
    startTransition(async () => {
      const result = await setCatalogEntryActive(id, isActive);
      if (result.success) reload();
      else toast.error(result.error ?? tc("saveFailed"));
    });
  };

  const from = data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1;
  const to = Math.min(data.page * data.pageSize, data.total);
  const lastPage = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div>
      <PanelHeader
        title={t("title")}
        description={t("description")}
        action={
          canManage && (
            <Button size="sm" onClick={() => setDialog({ entry: null })}>
              <Plus className="size-4" />
              {t("add")}
            </Button>
          )
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder={t("search")}
          aria-label={t("search")}
          className="w-full sm:max-w-sm"
        />
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as Status);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44" aria-label={tc("status")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`status.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div
        className={cn(
          "overflow-x-auto rounded-md border transition-opacity",
          isPending && "opacity-60"
        )}
      >
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{tc("name")}</TableHead>
              <TableHead className="hidden xl:table-cell">
                {t("vendor")}
              </TableHead>
              <TableHead>{t("category")}</TableHead>
              <TableHead className="hidden w-32 xl:table-cell">
                {t("pricingModel")}
              </TableHead>
              <TableHead className="w-32 text-right">{t("price")}</TableHead>
              <TableHead className="w-28">{tc("status")}</TableHead>
              {canManage && (
                <TableHead className="w-24 text-right">
                  {tc("actions")}
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-muted-foreground py-8 text-center text-sm"
                >
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {data.items.map((row) => (
              <TableRow
                key={row.id}
                className={cn(!row.isActive && "text-muted-foreground")}
              >
                <TableCell className="max-w-[16rem]">
                  <span className="block truncate font-medium" title={row.name}>
                    {row.name}
                  </span>
                  {row.website && (
                    <span
                      className="text-muted-foreground block truncate text-[0.8125rem]"
                      title={row.website}
                    >
                      {row.website}
                    </span>
                  )}
                </TableCell>
                <TableCell className="hidden max-w-[12rem] truncate text-sm xl:table-cell">
                  {row.vendorName ?? "—"}
                </TableCell>
                <TableCell className="max-w-[14rem]">
                  <span className="block truncate text-sm" title={row.category}>
                    {row.category}
                  </span>
                </TableCell>
                <TableCell className="hidden text-sm xl:table-cell">
                  {row.pricingModel
                    ? t(`pricingModels.${row.pricingModel}`)
                    : "—"}
                </TableCell>
                <TableCell className="text-right font-mono text-sm whitespace-nowrap tabular-nums">
                  {priceLabel(row)}
                </TableCell>
                <TableCell>
                  <StatusBadge active={row.isActive} />
                </TableCell>
                {canManage && (
                  <TableCell className="text-right whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={`${tc("edit")} ${row.name}`}
                      onClick={() => setDialog({ entry: row })}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <ActiveToggleButton
                      active={row.isActive}
                      label={row.name}
                      disabled={isPending}
                      onToggle={(v) => setActive(row.id, v)}
                    />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <span className="text-muted-foreground text-[0.8125rem] tabular-nums">
          {t("pageInfo", { from, to, total: data.total })}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          aria-label={t("previous")}
          disabled={data.page <= 1 || isPending}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          aria-label={t("next")}
          disabled={data.page >= lastPage || isPending}
          onClick={() => setPage((p) => p + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      {dialog && (
        <CatalogEntryDialog
          key={dialog.entry?.id ?? "new"}
          open
          onOpenChange={(o) => !o && setDialog(null)}
          entry={dialog.entry}
          categories={data.categories}
          currencyCodes={currencyCodes}
          countries={countries}
          canManageGlobal={canManageGlobal}
          onSaved={reload}
        />
      )}
    </div>
  );
}
