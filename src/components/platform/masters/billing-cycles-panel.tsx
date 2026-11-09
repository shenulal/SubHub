"use client";

import { updateBillingCycle } from "@/actions/platform/masters/billing-cycles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BillingCycleRow } from "@/types/platform";
import { Check, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  MasterListNoMatches,
  MasterListToolbar,
  useMasterList,
} from "./master-list";
import { PanelHeader } from "./master-shared";

interface BillingCyclesPanelProps {
  rows: BillingCycleRow[];
  canManage: boolean;
}

export function BillingCyclesPanel({
  rows,
  canManage,
}: BillingCyclesPanelProps) {
  const t = useTranslations("platform.masters.billingCycles");
  const tc = useTranslations("platform.masters.common");
  const router = useRouter();
  const [drafts, setDrafts] = useState(rows);
  const [isPending, startTransition] = useTransition();
  useEffect(() => setDrafts(rows), [rows]);
  const list = useMasterList(drafts, {
    searchText: (r) => [r.cycle, r.label],
    isActive: (r) => r.isEnabled,
  });

  const update = (cycle: string, patch: Partial<BillingCycleRow>) =>
    setDrafts((prev) =>
      prev.map((r) => (r.cycle === cycle ? { ...r, ...patch } : r))
    );

  const save = (row: BillingCycleRow) => {
    startTransition(async () => {
      const result = await updateBillingCycle({
        cycle: row.cycle,
        label: row.label,
        months: row.months,
        isEnabled: row.isEnabled,
      });
      if (result.success) {
        toast.success(tc("saved"));
        router.refresh();
      } else toast.error(result.error ?? tc("saveFailed"));
    });
  };

  const isDirty = (row: BillingCycleRow) => {
    const original = rows.find((r) => r.cycle === row.cycle);
    return (
      !original ||
      original.label !== row.label ||
      original.months !== row.months ||
      original.isEnabled !== row.isEnabled
    );
  };

  return (
    <div>
      <PanelHeader title={t("title")} description={t("description")} />
      <MasterListToolbar
        list={list}
        searchPlaceholder={t("search")}
        statusLabels={{
          active: t("statusEnabled"),
          inactive: t("statusDisabled"),
        }}
      />
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-36">{t("cycle")}</TableHead>
              <TableHead>{t("label")}</TableHead>
              <TableHead className="w-32">{t("months")}</TableHead>
              <TableHead className="w-28">{t("enabled")}</TableHead>
              {canManage && (
                <TableHead className="w-24 text-right">
                  {tc("actions")}
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {drafts.length > 0 && list.visible.length === 0 && (
              <MasterListNoMatches colSpan={canManage ? 5 : 4} />
            )}
            {list.visible.map((row) => (
              <TableRow key={row.cycle}>
                <TableCell className="font-mono text-xs font-medium">
                  {row.cycle}
                </TableCell>
                <TableCell>
                  <Input
                    value={row.label}
                    disabled={!canManage}
                    onChange={(e) =>
                      update(row.cycle, { label: e.target.value })
                    }
                    className="max-w-xs"
                    aria-label={`${row.cycle} ${t("label")}`}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={0}
                    max={120}
                    value={row.months}
                    disabled={!canManage || row.cycle === "ONE_TIME"}
                    onChange={(e) =>
                      update(row.cycle, { months: Number(e.target.value) })
                    }
                    className="w-24 font-mono"
                    aria-label={`${row.cycle} ${t("months")}`}
                  />
                </TableCell>
                <TableCell>
                  <Switch
                    checked={row.isEnabled}
                    disabled={!canManage}
                    onCheckedChange={(v) => update(row.cycle, { isEnabled: v })}
                    aria-label={`${row.cycle} ${t("enabled")}`}
                  />
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant={isDirty(row) ? "default" : "ghost"}
                      disabled={!isDirty(row) || isPending}
                      onClick={() => save(row)}
                    >
                      {isPending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Check className="size-3.5" />
                      )}
                      {tc("save")}
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
