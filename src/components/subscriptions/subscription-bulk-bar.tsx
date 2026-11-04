// src/components/subscriptions/subscription-bulk-bar.tsx
"use client";

/**
 * Bulk actions (9.6): floating bar shown when rows are selected. Set category,
 * add/remove tags, assign owner, set cost centre, archive, export selected.
 * Supports "select all matching" beyond the current page.
 */
import { exportSubscriptionsCsv } from "@/actions/discovery/export";
import { bulkUpdateSubscriptions } from "@/actions/subscriptions/subscription-lifecycle";
import { Can } from "@/components/common/can";
import { Button } from "@/components/ui/button";
import { downloadCSV } from "@/lib/services/export/csv";
import { cn } from "@/lib/utils";
import type {
  NamedOption,
  SubscriptionFilterOptions,
  SubscriptionListFilter,
} from "@/types/discovery";
import { Archive, Download, Loader2, Tag, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  MultiSelectPopover,
  SingleSelectPopover,
} from "./subscription-filters-shared";

export interface BulkPatch {
  categoryId?: string | null;
  addTagNames?: string[];
  removeTagIds?: string[];
  ownerId?: string | null;
  costCenterId?: string | null;
  archive?: boolean;
}

interface SubscriptionBulkBarProps {
  selectedIds: string[];
  /** Total rows matching the current filter (for "select all matching"). */
  matchingTotal: number;
  /** Rows rendered on the current page (select-all appears once they are all selected). */
  pageRowCount: number;
  allMatchingSelected: boolean;
  onSelectAllMatching: () => Promise<void>;
  onClear: () => void;
  options: SubscriptionFilterOptions;
  filter: SubscriptionListFilter;
  /** Ids used for the export: selected rows only. */
  onExported?: () => void;
  bulkUpdate?: typeof bulkUpdateSubscriptions;
}

function flattenCategories(options: SubscriptionFilterOptions): NamedOption[] {
  return options.categories.flatMap((p) => [
    { id: p.id, name: p.name, color: p.color },
    ...(p.children ?? []).map((c) => ({
      id: c.id,
      name: `${p.name} › ${c.name}`,
      color: c.color,
    })),
  ]);
}

export function SubscriptionBulkBar({
  selectedIds,
  matchingTotal,
  pageRowCount,
  allMatchingSelected,
  onSelectAllMatching,
  onClear,
  options,
  onExported,
  bulkUpdate = bulkUpdateSubscriptions,
}: SubscriptionBulkBarProps) {
  const t = useTranslations("discovery.bulk");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [addTags, setAddTags] = useState<string[]>([]);
  const [removeTags, setRemoveTags] = useState<string[]>([]);

  const count = selectedIds.length;
  if (count === 0) return null;

  const apply = (patch: BulkPatch, successKey: string) => {
    startTransition(async () => {
      const result = await bulkUpdate(selectedIds, patch);
      if (result.success) {
        toast.success(t(successKey, { count: result.data?.updated ?? count }));
        setAddTags([]);
        setRemoveTags([]);
        onClear();
        router.refresh();
      } else {
        toast.error(result.error ?? t("failed"));
      }
    });
  };

  const applyTags = () => {
    const names = addTags
      .map((id) => options.tags.find((tag) => tag.id === id)?.name)
      .filter((n): n is string => Boolean(n));
    if (!names.length && !removeTags.length) return;
    apply(
      {
        ...(names.length && { addTagNames: names }),
        ...(removeTags.length && { removeTagIds: removeTags }),
      },
      "tagsUpdated"
    );
  };

  const exportSelected = () => {
    startTransition(async () => {
      const result = await exportSubscriptionsCsv({
        filter: { includeArchived: true },
        ids: selectedIds,
      });
      if (result.success && result.data) {
        downloadCSV(result.data.csv, result.data.filename);
        toast.success(t("exported", { count: result.data.rowCount }));
        onExported?.();
      } else {
        toast.error(result.error ?? t("failed"));
      }
    });
  };

  const showSelectAll =
    !allMatchingSelected && matchingTotal > count && count >= pageRowCount;

  return (
    <div
      role="region"
      aria-label={t("region")}
      data-testid="subscription-bulk-bar"
      className={cn(
        "bg-card/95 border-primary/30 sticky bottom-3 z-20 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 shadow-lg backdrop-blur",
        "ring-primary/10 ring-1"
      )}
    >
      <div className="flex items-center gap-2 pr-2">
        <span className="bg-primary text-primary-foreground inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold">
          {count}
        </span>
        <span className="text-sm">{t("selected")}</span>
        {showSelectAll && (
          <button
            type="button"
            className="text-primary text-xs underline-offset-2 hover:underline"
            onClick={() => void onSelectAllMatching()}
            disabled={isPending}
          >
            {t("selectAllMatching", { total: matchingTotal })}
          </button>
        )}
        {allMatchingSelected && (
          <span className="text-muted-foreground text-xs">
            {t("allMatching")}
          </span>
        )}
      </div>

      <Can permission="subscriptions:bulk">
        <SingleSelectPopover
          label={t("setCategory")}
          options={flattenCategories(options)}
          value={undefined}
          onChange={(id) => id && apply({ categoryId: id }, "categoryUpdated")}
        />
        <MultiSelectPopover
          label={t("addTags")}
          options={options.tags}
          selected={addTags}
          onChange={setAddTags}
          showColor
        />
        <MultiSelectPopover
          label={t("removeTags")}
          options={options.tags}
          selected={removeTags}
          onChange={setRemoveTags}
          showColor
        />
        {(addTags.length > 0 || removeTags.length > 0) && (
          <Button
            size="sm"
            className="h-8"
            onClick={applyTags}
            disabled={isPending}
          >
            <Tag className="mr-1 h-3.5 w-3.5" />
            {t("applyTags")}
          </Button>
        )}
        <SingleSelectPopover
          label={t("assignOwner")}
          options={options.owners}
          value={undefined}
          onChange={(id) => id && apply({ ownerId: id }, "ownerUpdated")}
        />
        <SingleSelectPopover
          label={t("setCostCenter")}
          options={options.costCenters}
          value={undefined}
          onChange={(id) =>
            id && apply({ costCenterId: id }, "costCenterUpdated")
          }
        />
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => apply({ archive: true }, "archived")}
          disabled={isPending}
        >
          <Archive className="mr-1 h-3.5 w-3.5" />
          {t("archive")}
        </Button>
      </Can>
      <Can permission="subscriptions:export">
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={exportSelected}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="mr-1 h-3.5 w-3.5" />
          )}
          {t("exportSelected")}
        </Button>
      </Can>

      <Button
        variant="ghost"
        size="icon"
        className="ml-auto h-8 w-8"
        onClick={onClear}
        aria-label={t("clear")}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
