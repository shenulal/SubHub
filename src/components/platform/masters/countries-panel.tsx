"use client";

/** Master data → Countries (platform-wide; edits need masters:manage_global). */
import { setCountryActive } from "@/actions/platform/masters/countries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { CountryRow } from "@/types/platform";
import { Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { CountryDialog } from "./country-dialog";
import { ActiveToggleButton, PanelHeader, StatusBadge } from "./master-shared";

export interface CountriesPanelProps {
  rows: CountryRow[];
  currencyCodes: string[];
  canManageGlobal: boolean;
}

type DialogState = { country: CountryRow | null } | null;

function matches(row: CountryRow, q: string): boolean {
  return [row.code, row.name, row.region ?? "", row.currencyCode ?? ""].some(
    (v) => v.toLowerCase().includes(q)
  );
}

export function CountriesPanel({
  rows,
  currencyCodes,
  canManageGlobal,
}: CountriesPanelProps) {
  const t = useTranslations("platform.masters.countries");
  const tc = useTranslations("platform.masters.common");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [isPending, startTransition] = useTransition();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((r) => matches(r, q)) : rows;
  }, [rows, query]);

  const setActive = (code: string, isActive: boolean) => {
    startTransition(async () => {
      const result = await setCountryActive({ code, isActive });
      if (result.success) router.refresh();
      else toast.error(result.error ?? tc("saveFailed"));
    });
  };

  return (
    <div>
      <PanelHeader
        title={t("title")}
        description={t("description")}
        action={
          canManageGlobal && (
            <Button size="sm" onClick={() => setDialog({ country: null })}>
              <Plus className="size-4" />
              {t("add")}
            </Button>
          )
        }
      />
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("search")}
        aria-label={t("search")}
        className="mb-4 w-full sm:max-w-xs"
      />
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-20">{tc("code")}</TableHead>
              <TableHead>{tc("name")}</TableHead>
              <TableHead>{t("region")}</TableHead>
              <TableHead className="w-24">{t("currency")}</TableHead>
              <TableHead className="w-28 text-right">
                {t("defaultTax")}
              </TableHead>
              <TableHead className="w-28">{t("phonePrefix")}</TableHead>
              <TableHead className="w-28">{tc("status")}</TableHead>
              {canManageGlobal && (
                <TableHead className="w-24 text-right">
                  {tc("actions")}
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-muted-foreground py-8 text-center text-sm"
                >
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {visible.map((row) => (
              <TableRow
                key={row.code}
                className={cn(!row.isActive && "text-muted-foreground")}
              >
                <TableCell className="font-mono text-xs font-medium">
                  {row.code}
                </TableCell>
                <TableCell className="max-w-[16rem]">
                  <span className="block truncate font-medium" title={row.name}>
                    {row.name}
                  </span>
                </TableCell>
                <TableCell className="text-sm">{row.region ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">
                  {row.currencyCode ?? "—"}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {row.defaultTaxRatePercent === null
                    ? "—"
                    : `${row.defaultTaxRatePercent}%`}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {row.phonePrefix ?? "—"}
                </TableCell>
                <TableCell>
                  <StatusBadge active={row.isActive} />
                </TableCell>
                {canManageGlobal && (
                  <TableCell className="text-right whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={`${tc("edit")} ${row.code}`}
                      onClick={() => setDialog({ country: row })}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <ActiveToggleButton
                      active={row.isActive}
                      label={row.code}
                      disabled={isPending}
                      onToggle={(v) => setActive(row.code, v)}
                    />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {dialog && (
        <CountryDialog
          key={dialog.country?.code ?? "new"}
          open
          onOpenChange={(o) => !o && setDialog(null)}
          country={dialog.country}
          currencyCodes={currencyCodes}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}
