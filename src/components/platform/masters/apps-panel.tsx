"use client";

/**
 * Master data → Apps: the organisation's own app register, laid out like the
 * App catalog list (search, status filter, paging). "Add app" opens the shared
 * Create app dialog; each row opens the app's page, where it is edited.
 */
import {
  listAppsForMasters,
  type AppsMasterPage,
} from "@/actions/apps-master-list";
import { AppLogo } from "@/components/apps/app-logo";
import { CreateAppDialog } from "@/components/common/quick-create/create-app-dialog";
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
import { getAppStatusMeta, getAppStatusOptions } from "@/lib/app-status";
import { cn } from "@/lib/utils";
import type { AppStatus } from "@prisma/client";
import { ChevronLeft, ChevronRight, ExternalLink, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { PanelHeader } from "./master-shared";

export interface AppsPanelProps {
  initial: AppsMasterPage;
  canManage: boolean;
  /** Debounce for the search box, from `discovery.searchDebounceMs`. */
  searchDebounceMs: number;
}

type StatusFilter = "all" | AppStatus;

const STATUS_TONE: Record<AppStatus, string> = {
  ACTIVE: "tonal-success",
  INACTIVE: "tonal-neutral",
  PENDING_REVIEW: "tonal-warning",
  BLOCKED: "tonal-error",
};

export function AppsPanel({
  initial,
  canManage,
  searchDebounceMs,
}: AppsPanelProps) {
  const t = useTranslations("platform.masters.apps");
  const tc = useTranslations("platform.masters.common");
  const tCatalog = useTranslations("platform.masters.catalog");
  const tRoot = useTranslations();
  const [data, setData] = useState<AppsMasterPage>(initial);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const firstRun = useRef(true);

  const load = (next: {
    query: string;
    status: StatusFilter;
    page: number;
  }) => {
    startTransition(async () => {
      const result = await listAppsForMasters(next);
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

  const from = data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1;
  const to = Math.min(data.page * data.pageSize, data.total);
  const lastPage = Math.max(1, Math.ceil(data.total / data.pageSize));
  const statusOptions = getAppStatusOptions(tRoot);

  return (
    <div>
      <PanelHeader
        title={t("title")}
        description={t("description")}
        action={
          canManage && (
            <Button size="sm" onClick={() => setIsCreateOpen(true)}>
              <Plus className="size-4" />
              {t("add")}
            </Button>
          )
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          type="search"
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
            setStatus(v as StatusFilter);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44" aria-label={tc("status")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStatuses")}</SelectItem>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
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
              <TableHead>{t("category")}</TableHead>
              <TableHead className="hidden xl:table-cell">
                {t("owner")}
              </TableHead>
              <TableHead className="w-28 text-right">
                {t("subscriptions")}
              </TableHead>
              <TableHead className="hidden 2xl:table-cell">
                {tCatalog("title")}
              </TableHead>
              <TableHead className="w-28">{tc("status")}</TableHead>
              <TableHead className="w-16 text-right">
                <span className="sr-only">{t("open")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={7}
                  className="text-muted-foreground py-8 text-center text-sm"
                >
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {data.items.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="max-w-[18rem]">
                  <div className="flex min-w-0 items-center gap-3">
                    <AppLogo
                      src={row.customLogoUrl ?? row.catalogLogoUrl ?? null}
                      name={row.name}
                      className="size-8 rounded-md"
                    />
                    <Link
                      href={`/apps/${row.id}`}
                      className="hover:text-primary truncate font-medium"
                      title={row.name}
                    >
                      {row.name}
                    </Link>
                  </div>
                </TableCell>
                <TableCell className="max-w-[12rem]">
                  <span className="block truncate text-sm">
                    {row.category ?? "—"}
                  </span>
                </TableCell>
                <TableCell className="hidden max-w-[12rem] truncate text-sm xl:table-cell">
                  {row.ownerName ?? row.ownerEmail ?? "—"}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {row.subscriptionCount}
                </TableCell>
                <TableCell className="text-muted-foreground hidden max-w-[12rem] truncate text-sm 2xl:table-cell">
                  {row.catalogName ?? t("notLinked")}
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
                      STATUS_TONE[row.status]
                    )}
                  >
                    {getAppStatusMeta(row.status, tRoot).label}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                  >
                    <Link
                      href={`/apps/${row.id}`}
                      aria-label={`${t("open")} ${row.name}`}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <span className="text-muted-foreground text-[0.8125rem] tabular-nums">
          {tCatalog("pageInfo", { from, to, total: data.total })}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          aria-label={tCatalog("previous")}
          disabled={data.page <= 1 || isPending}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          aria-label={tCatalog("next")}
          disabled={data.page >= lastPage || isPending}
          onClick={() => setPage((p) => p + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <CreateAppDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={() => load({ query, status, page })}
      />
    </div>
  );
}
