// src/app/(dashboard)/extensions/status/page.tsx
/**
 * Extension status monitoring page
 * Lets admins check the status of users who installed the extension
 */

"use client";

import {
  deleteExtensionDevice,
  getExtensionStatus,
  updateInactiveThreshold,
  type ExtensionComputedStatus,
  type ExtensionDeviceStatusItem,
  type ExtensionStatusStats,
} from "@/actions/extensions/status";
import { FilterMultiSelect } from "@/components/common/filter-multi-select";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Activity,
  Clock,
  Monitor,
  Search,
  ShieldCheck,
  Trash2,
  UserX,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const STATUS_OPTIONS: Array<{ value: ExtensionComputedStatus; label: string }> =
  [
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
    { value: "pending", label: "Pending" },
    { value: "revoked", label: "Revoked" },
  ];

const statusConfig = {
  active: {
    label: "Active",
    variant: "success" as const,
    color: "bg-success",
  },
  inactive: {
    label: "Inactive",
    variant: "warning" as const,
    color: "bg-warning",
  },
  pending: {
    label: "Pending",
    variant: "neutral" as const,
    color: "bg-muted-foreground",
  },
  revoked: {
    label: "Revoked",
    variant: "error" as const,
    color: "bg-error",
  },
};

function StatTile({
  icon: Icon,
  tone,
  label,
  children,
}: {
  icon: typeof Monitor;
  tone: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border dark:border-border gap-0 border px-5 shadow-none">
      <div className="flex min-w-0 items-center gap-4">
        <span
          className={`${tone} flex size-10 shrink-0 items-center justify-center rounded-md`}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <CardTitle className="text-muted-foreground truncate text-[0.8125rem] font-normal">
            {label}
          </CardTitle>
          <div className="kpi-value text-foreground">{children}</div>
        </div>
      </div>
    </Card>
  );
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${diffDay}d ago`;
}

function StatsCards({ stats }: { stats: ExtensionStatusStats }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
      <StatTile icon={Monitor} tone="tonal-primary" label="Total devices">
        {stats.total}
      </StatTile>
      <StatTile icon={Activity} tone="tonal-success" label="Active">
        <span className="text-success">{stats.active}</span>
      </StatTile>
      <StatTile icon={Clock} tone="tonal-warning" label="Inactive">
        <span className="text-warning">{stats.inactive}</span>
      </StatTile>
      <StatTile icon={UserX} tone="tonal-neutral" label="Pending / Revoked">
        {stats.pending}{" "}
        <span className="text-muted-foreground text-sm font-normal">
          / {stats.revoked}
        </span>
      </StatTile>
    </div>
  );
}

export default function ExtensionStatusPage() {
  const [data, setData] = useState<ExtensionDeviceStatusItem[]>([]);
  const [stats, setStats] = useState<ExtensionStatusStats>({
    total: 0,
    active: 0,
    inactive: 0,
    pending: 0,
    revoked: 0,
  });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  // Computed statuses: multi-select (empty = all)
  const [statusFilter, setStatusFilter] = useState<ExtensionComputedStatus[]>(
    []
  );
  const [thresholdMinutes, setThresholdMinutes] = useState(30);
  const [thresholdInput, setThresholdInput] = useState("30");
  const [deleteConfirm, setDeleteConfirm] =
    useState<ExtensionDeviceStatusItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getExtensionStatus({
        page,
        limit: 20,
        search: search || undefined,
        statuses: statusFilter,
      });
      setData(result.data);
      setStats(result.stats);
      setTotalPages(result.pagination.totalPages);
      setThresholdMinutes(result.inactiveThresholdMinutes);
      setThresholdInput(String(result.inactiveThresholdMinutes));
    } catch (error) {
      console.error("Failed to load extension status:", error);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleThresholdUpdate = async () => {
    const minutes = parseInt(thresholdInput, 10);
    if (isNaN(minutes)) return;
    const result = await updateInactiveThreshold(minutes);
    if (result.success) {
      setThresholdMinutes(minutes);
      loadData();
    }
  };

  const handleDelete = async (device: ExtensionDeviceStatusItem) => {
    setDeleting(true);
    try {
      const result = await deleteExtensionDevice(device.id);
      if (result.success) {
        toast.success(result.message);
        loadData();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Failed to delete the device");
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-foreground text-xl font-medium">
        Extension Status Monitor
      </h1>

      <StatsCards stats={stats} />

      {/* Inactivity threshold setting */}
      <Card className="border-border dark:border-border gap-4 border shadow-none">
        <CardHeader>
          <CardTitle>Inactivity Threshold</CardTitle>
          <CardDescription>
            Devices are marked inactive once the specified time has passed since
            their last connection.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="number"
              value={thresholdInput}
              onChange={(e) => setThresholdInput(e.target.value)}
              min={5}
              max={10080}
              className="w-24"
            />
            <span className="text-muted-foreground text-sm">
              minutes (current: {thresholdMinutes} min)
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleThresholdUpdate}
              disabled={
                parseInt(thresholdInput) === thresholdMinutes ||
                isNaN(parseInt(thresholdInput))
              }
            >
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative max-w-sm min-w-[200px] flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search name, email, device ID..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <FilterMultiSelect
          label="Status"
          placeholder="All statuses"
          options={STATUS_OPTIONS}
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v as ExtensionComputedStatus[]);
            setPage(1);
          }}
        />
      </div>

      {/* Table */}
      <Card className="border-border dark:border-border gap-0 overflow-hidden border py-0 shadow-none">
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Browser</TableHead>
                <TableHead>Last seen</TableHead>
                <TableHead>Device ID</TableHead>
                <TableHead className="w-[60px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center">
                    <div className="text-muted-foreground">Loading...</div>
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center">
                    <div className="text-muted-foreground flex flex-col items-center gap-2">
                      <ShieldCheck className="h-8 w-8" />
                      <span>No extension devices registered.</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                data.map((device) => {
                  const statusInfo = statusConfig[device.computedStatus];
                  return (
                    <TableRow key={device.id}>
                      <TableCell>
                        <div className="max-w-[240px] min-w-0">
                          <div className="text-foreground truncate font-medium">
                            {device.userName || "-"}
                          </div>
                          <div className="text-muted-foreground truncate text-xs">
                            {device.userEmail || device.onboardingEmail || "-"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusInfo.variant}>
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {device.extensionVersion || "-"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">
                        {device.browserInfo || "-"}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatRelativeTime(device.lastSeenAt)}
                      </TableCell>
                      <TableCell>
                        <code className="text-muted-foreground text-xs">
                          {device.deviceKey.length > 20
                            ? `${device.deviceKey.slice(0, 20)}...`
                            : device.deviceKey}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive h-8 w-8"
                          onClick={() => setDeleteConfirm(device)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className="text-muted-foreground text-sm">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <AlertDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this device?</AlertDialogTitle>
            <AlertDialogDescription>
              The device record for{" "}
              {deleteConfirm?.userName ||
                deleteConfirm?.userEmail ||
                deleteConfirm?.deviceKey}{" "}
              will be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
