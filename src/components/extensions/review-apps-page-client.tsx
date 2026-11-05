// src/components/extensions/review-apps-page-client.tsx
"use client";

import {
  blockReviewApp,
  bulkBlockReviewApps,
  bulkRegisterReviewApps,
  dismissReviewApp,
  getReviewApps,
  getScanScheduleStatus,
  registerReviewApp,
  type ReviewAppItem,
  type ReviewAppType,
} from "@/actions/extensions/review-apps";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  AppWindow,
  Ban,
  ExternalLink,
  MoreHorizontal,
  Plus,
  ShieldAlert,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type ScheduleStatus = {
  totalScannedCount: number;
  pendingScanCount: number;
  lastScanAt: Date | null;
  nextScanAt: Date;
};

export function ReviewAppsPageClient() {
  const t = useTranslations("extensions");
  const router = useRouter();
  const [items, setItems] = useState<ReviewAppItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "malicious" | "saas">("all");
  const [registering, setRegistering] = useState<string | null>(null);
  const [blocking, setBlocking] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState({ maliciousCount: 0, saasCount: 0 });
  const [scheduleStatus, setScheduleStatus] = useState<ScheduleStatus | null>(
    null
  );
  const [dismissConfirm, setDismissConfirm] = useState<ReviewAppItem | null>(
    null
  );

  // Block modal state
  const [blockModal, setBlockModal] = useState<{
    open: boolean;
    item: ReviewAppItem | null;
    reason: string;
  }>({ open: false, item: null, reason: "" });

  // Bulk block dialog state
  const [bulkBlockDialog, setBulkBlockDialog] = useState<{
    open: boolean;
    reason: string;
  }>({ open: false, reason: "" });

  async function fetchData() {
    setLoading(true);
    const [reviewResult, scheduleResult] = await Promise.all([
      getReviewApps({ filter }),
      getScanScheduleStatus(),
    ]);
    if (reviewResult.success && reviewResult.data) {
      setItems(reviewResult.data.items);
      setStats(reviewResult.data.stats);
    }
    if (scheduleResult.success && scheduleResult.data) {
      setScheduleStatus(scheduleResult.data);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function handleRegister(item: ReviewAppItem) {
    setRegistering(item.id);
    const result = await registerReviewApp(item.id);
    if (result.success) {
      toast.success(t("reviewApps.appRegistered"));
      if (result.data?.appId) {
        router.push(`/apps/${result.data.appId}`);
      }
      fetchData();
    } else {
      toast.error(result.error || t("common.registerFailed"));
    }
    setRegistering(null);
  }

  async function handleBlock(item: ReviewAppItem, reason?: string) {
    setBlocking(item.id);
    const result = await blockReviewApp(item.id, reason);
    if (result.success) {
      toast.success(t("reviewApps.blocked"));
      fetchData();
    } else {
      toast.error(result.error || t("common.blockFailed"));
    }
    setBlocking(null);
    setBlockModal({ open: false, item: null, reason: "" });
  }

  async function handleDismiss(item: ReviewAppItem) {
    const result = await dismissReviewApp(item.id);
    if (result.success) {
      toast.success(t("reviewApps.dismissed"));
      fetchData();
    } else {
      toast.error(result.error || t("common.processFailed"));
    }
    setDismissConfirm(null);
  }

  async function handleBulkRegister() {
    if (selectedIds.size === 0) return;

    const result = await bulkRegisterReviewApps(Array.from(selectedIds));
    if (result.success) {
      toast.success(result.message);
      setSelectedIds(new Set());
      fetchData();
    } else {
      toast.error(result.error || t("common.bulkRegisterFailed"));
    }
  }

  async function handleBulkBlock() {
    if (selectedIds.size === 0) return;

    const result = await bulkBlockReviewApps(
      Array.from(selectedIds),
      bulkBlockDialog.reason || undefined
    );
    if (result.success) {
      toast.success(result.message);
      setSelectedIds(new Set());
      fetchData();
    } else {
      toast.error(result.error || t("common.bulkBlockFailed"));
    }
    setBulkBlockDialog({ open: false, reason: "" });
  }

  function toggleSelectAll() {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
    }
  }

  function toggleSelect(id: string) {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  }

  function handleFilterToggle(value: "malicious" | "saas") {
    setFilter((prev) => (prev === value ? "all" : value));
  }

  function getTypeBadge(type: ReviewAppType) {
    if (type === "malicious") {
      return (
        <Badge variant="error" className="gap-1">
          <ShieldAlert className="h-3 w-3" />
          {t("reviewApps.typeBadge.malicious")}
        </Badge>
      );
    }
    return (
      <Badge variant="info" className="gap-1">
        <AppWindow className="h-3 w-3" />
        {t("reviewApps.typeBadge.saas")}
      </Badge>
    );
  }

  function formatConfidence(confidence: number | null): string {
    if (!confidence) return "-";
    return `${Math.round(confidence * 100)}%`;
  }

  function formatNextScan(date: Date): string {
    const d = new Date(date);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Scan schedule status card */}
      <Card className="bg-muted gap-0 py-4 shadow-none">
        <CardContent>
          <div className="divide-border grid grid-cols-3 gap-4 divide-x text-center">
            <div className="min-w-0 px-2">
              <p className="text-muted-foreground truncate text-xs tracking-wide uppercase">
                {t("reviewApps.scanSchedule.totalScanned")}
              </p>
              <p className="text-foreground truncate text-lg font-medium tabular-nums">
                {scheduleStatus?.totalScannedCount.toLocaleString() ?? "-"}
              </p>
            </div>
            <div className="min-w-0 px-2">
              <p className="text-muted-foreground truncate text-xs tracking-wide uppercase">
                {t("reviewApps.scanSchedule.pending")}
              </p>
              <p className="text-foreground truncate text-lg font-medium tabular-nums">
                {scheduleStatus?.pendingScanCount.toLocaleString() ?? "-"}
              </p>
            </div>
            <div className="min-w-0 px-2">
              <p className="text-muted-foreground truncate text-xs tracking-wide uppercase">
                {t("reviewApps.scanSchedule.nextScan")}
              </p>
              <p className="text-foreground truncate pt-1 text-sm font-medium tabular-nums">
                {scheduleStatus
                  ? formatNextScan(scheduleStatus.nextScanAt)
                  : "-"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filter badge CTAs and bulk actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleFilterToggle("malicious")}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
              filter === "malicious"
                ? "bg-error text-white shadow-sm"
                : "tonal-error hover:bg-error/25"
            }`}
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            {t("reviewApps.filterMalicious")}
            <span
              className={`rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums ${
                filter === "malicious"
                  ? "bg-white/25 text-white"
                  : "bg-error/20"
              }`}
            >
              {stats.maliciousCount}
            </span>
          </button>
          <button
            onClick={() => handleFilterToggle("saas")}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
              filter === "saas"
                ? "bg-info text-white shadow-sm"
                : "tonal-info hover:bg-info/25"
            }`}
          >
            <AppWindow className="h-3.5 w-3.5" />
            {t("reviewApps.filterSaas")}
            <span
              className={`rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums ${
                filter === "saas" ? "bg-white/25 text-white" : "bg-info/20"
              }`}
            >
              {stats.saasCount}
            </span>
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.size > 0 && (
            <>
              <Button variant="default" size="sm" onClick={handleBulkRegister}>
                <Plus className="mr-1 h-4 w-4" />
                {t("reviewApps.bulkRegister", { count: selectedIds.size })}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setBulkBlockDialog({ open: true, reason: "" })}
              >
                <Ban className="mr-1 h-4 w-4" />
                {t("reviewApps.bulkBlock", { count: selectedIds.size })}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Review apps table */}
      <Card className="border-border dark:border-border gap-0 overflow-hidden border py-0 shadow-none">
        <CardContent className="px-0">
          {items.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-muted-foreground text-[0.9375rem]">
                {t("reviewApps.emptyTitle")}
              </p>
              <p className="text-muted-foreground mt-2 text-sm">
                {t("reviewApps.emptyDescription")}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectedIds.size === items.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>{t("reviewApps.tableHeaders.domain")}</TableHead>
                  <TableHead>{t("reviewApps.tableHeaders.type")}</TableHead>
                  <TableHead>{t("reviewApps.tableHeaders.reason")}</TableHead>
                  <TableHead className="text-right">
                    {t("reviewApps.tableHeaders.visitCount")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("reviewApps.tableHeaders.uniqueUsers")}
                  </TableHead>
                  <TableHead>{t("reviewApps.tableHeaders.lastSeen")}</TableHead>
                  <TableHead className="w-[180px]">
                    {t("reviewApps.tableHeaders.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow
                    key={item.id}
                    className={
                      item.type === "malicious" ? "bg-error/[0.05]" : ""
                    }
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        onCheckedChange={() => toggleSelect(item.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex max-w-[240px] min-w-0 items-center gap-2">
                        <span
                          className="truncate font-mono text-sm"
                          title={item.domain}
                        >
                          {item.domain}
                        </span>
                        {item.website && (
                          <a
                            href={item.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary shrink-0"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      {item.serviceName && (
                        <p className="text-muted-foreground max-w-[240px] truncate text-xs">
                          {item.serviceName}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>{getTypeBadge(item.type)}</TableCell>
                    <TableCell>
                      <span className="text-sm">{item.reason}</span>
                      {item.type === "saas" && item.confidence && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {t("reviewApps.confidence", {
                            value: formatConfidence(item.confidence),
                          })}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.visitCount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.uniqueUsers}
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground text-sm whitespace-nowrap">
                        {new Date(item.lastSeenAt).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleRegister(item)}
                          disabled={registering === item.id}
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          {registering === item.id
                            ? "..."
                            : t("common.register")}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            setBlockModal({ open: true, item, reason: "" })
                          }
                          disabled={blocking === item.id}
                        >
                          <Ban className="mr-1 h-3 w-3" />
                          {blocking === item.id ? "..." : t("common.block")}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setDismissConfirm(item)}
                            >
                              <X className="mr-2 h-4 w-4" />
                              {t("common.dismiss")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Block reason modal */}
      <Dialog
        open={blockModal.open}
        onOpenChange={(open) => setBlockModal({ open, item: null, reason: "" })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("reviewApps.blockModal.title")}</DialogTitle>
            <DialogDescription>
              {t("reviewApps.blockModal.description", {
                domain: blockModal.item?.domain ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="block-reason">
                {t("reviewApps.blockModal.reasonLabel")}
              </Label>
              <Textarea
                id="block-reason"
                placeholder={t("reviewApps.blockModal.reasonPlaceholder")}
                value={blockModal.reason}
                onChange={(e) =>
                  setBlockModal((prev) => ({ ...prev, reason: e.target.value }))
                }
              />
            </div>
            {blockModal.item?.type === "malicious" && (
              <div className="rounded-sm bg-red-50 p-3 dark:bg-red-950">
                <p className="text-sm text-red-700 dark:text-red-400">
                  <ShieldAlert className="mr-1 inline-block h-4 w-4" />
                  {t("reviewApps.blockModal.maliciousWarning", {
                    reason: blockModal.item.reason,
                  })}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setBlockModal({ open: false, item: null, reason: "" })
              }
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                blockModal.item &&
                handleBlock(blockModal.item, blockModal.reason)
              }
            >
              {t("common.block")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk block reason dialog */}
      <Dialog
        open={bulkBlockDialog.open}
        onOpenChange={(open) => setBulkBlockDialog({ open, reason: "" })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("reviewApps.bulkBlockReasonTitle")}</DialogTitle>
            <DialogDescription>
              {t("reviewApps.bulkBlockReasonDescription", {
                count: selectedIds.size,
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-block-reason">
                {t("reviewApps.blockModal.reasonLabel")}
              </Label>
              <Textarea
                id="bulk-block-reason"
                placeholder={t("reviewApps.blockModal.reasonPlaceholder")}
                value={bulkBlockDialog.reason}
                onChange={(e) =>
                  setBulkBlockDialog((prev) => ({
                    ...prev,
                    reason: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkBlockDialog({ open: false, reason: "" })}
            >
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleBulkBlock}>
              {t("common.block")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dismiss confirmation */}
      <AlertDialog
        open={!!dismissConfirm}
        onOpenChange={(open) => !open && setDismissConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("reviewApps.confirmDismissTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("reviewApps.confirmDismiss", {
                domain: dismissConfirm?.domain ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => dismissConfirm && handleDismiss(dismissConfirm)}
            >
              {t("common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
