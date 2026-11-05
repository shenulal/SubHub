// src/components/devices/devices-page-client.tsx
"use client";

import { KpiCard, KpiCardsGrid } from "@/components/common/kpi-card";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  DeviceListResult,
  DeviceStats,
  ShadowITAppSummary,
} from "@/lib/services/fleetdm";
import { cn } from "@/lib/utils";
import type { DevicePlatform, DeviceStatus } from "@prisma/client";
import {
  AlertTriangle,
  CheckCircle,
  Laptop,
  RefreshCw,
  Search,
  Wifi,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState, useTransition } from "react";

import {
  fetchDevices,
  fetchDeviceStats,
  fetchShadowITApps,
  fetchUsersWithoutAgent,
  setDeviceAppApprovalStatus,
} from "@/actions/devices";
import { DevicesTable } from "./devices-table";
import { DevicesUsersAlert } from "./devices-users-alert";
import { FleetDMInstallGuide } from "./fleetdm-install-guide";
import { ShadowITTable } from "./shadow-it-table";

type Role = "ADMIN" | "APPROVER" | "MEMBER" | "VIEWER" | null | undefined;

interface DevicesPageClientProps {
  role?: Role;
}

interface UserWithoutAgent {
  id: string;
  name: string | null;
  email: string;
}

export function DevicesPageClient({ role }: DevicesPageClientProps) {
  const t = useTranslations("devices");
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState("devices");

  // Device list state
  const [deviceResult, setDeviceResult] = useState<DeviceListResult | null>(
    null
  );
  const [stats, setStats] = useState<DeviceStats | null>(null);
  const [shadowITApps, setShadowITApps] = useState<ShadowITAppSummary[]>([]);

  // Users without the agent installed
  const [usersWithoutAgent, setUsersWithoutAgent] = useState<
    UserWithoutAgent[]
  >([]);

  // Install guide sheet state
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");

  // Load data
  const loadData = useCallback(() => {
    startTransition(async () => {
      const [devicesRes, statsRes, shadowITRes, usersWithoutAgentRes] =
        await Promise.all([
          fetchDevices({
            status:
              statusFilter !== "all"
                ? (statusFilter as DeviceStatus)
                : undefined,
            platform:
              platformFilter !== "all"
                ? (platformFilter as DevicePlatform)
                : undefined,
            search: searchQuery || undefined,
          }),
          fetchDeviceStats(),
          fetchShadowITApps(),
          fetchUsersWithoutAgent(),
        ]);

      if (devicesRes.success && devicesRes.data) {
        setDeviceResult(devicesRes.data);
      }
      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      }
      if (shadowITRes.success && shadowITRes.data) {
        setShadowITApps(shadowITRes.data);
      }
      if (usersWithoutAgentRes.success && usersWithoutAgentRes.data) {
        setUsersWithoutAgent(usersWithoutAgentRes.data);
      }
    });
  }, [statusFilter, platformFilter, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Approve/block Shadow IT apps
  const handleApproveShadowIT = (appName: string, approve: boolean) => {
    if (role !== "ADMIN") return;

    startTransition(async () => {
      const result = await setDeviceAppApprovalStatus(
        appName,
        approve ? "APPROVED" : "BLOCKED"
      );
      if (result.success) {
        loadData();
      }
    });
  };

  const devices = deviceResult?.devices ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title={t("page.title")} />

      {/* KPI cards */}
      <KpiCardsGrid>
        <KpiCard
          title={t("kpi.totalDevices")}
          value={stats?.totalDevices ?? 0}
          icon={Laptop}
        />
        <KpiCard
          title={t("kpi.online")}
          value={stats?.onlineDevices ?? 0}
          icon={Wifi}
          description={t("kpi.onlineDescription")}
        />
        <KpiCard
          title={t("kpi.installationRate")}
          value={`${Math.round((stats?.installationRate ?? 0) * 100)}%`}
          icon={CheckCircle}
          description={t("kpi.installationDescription")}
        />
        <KpiCard
          title={t("kpi.shadowIT")}
          value={stats?.shadowITApps ?? 0}
          icon={AlertTriangle}
          description={t("kpi.shadowITDescription")}
        />
      </KpiCardsGrid>

      {/* Main content card */}
      <Card className="gap-0 py-0">
        <CardContent className="px-0 pb-5">
          {/* Not-installed users alert */}
          <DevicesUsersAlert
            usersWithoutAgent={usersWithoutAgent}
            onShowInstallGuide={() => setShowInstallGuide(true)}
          />

          {/* Tabs */}
          <div className="px-5 pt-5 sm:px-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="devices">{t("tabs.devices")}</TabsTrigger>
                <TabsTrigger value="shadow-it">
                  {t("tabs.shadowIT")}
                </TabsTrigger>
              </TabsList>

              {/* Device list tab */}
              <TabsContent value="devices" className="mt-4 space-y-4">
                {/* Filters */}
                <div className="bg-muted/60 rounded-md p-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="relative min-w-[200px] flex-1">
                      <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                      <Input
                        placeholder={t("filters.searchPlaceholder")}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-card pl-9"
                      />
                    </div>
                    <Select
                      value={statusFilter}
                      onValueChange={setStatusFilter}
                    >
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder={t("filters.status.label")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {t("filters.status.all")}
                        </SelectItem>
                        <SelectItem value="ONLINE">
                          {t("status.ONLINE")}
                        </SelectItem>
                        <SelectItem value="OFFLINE">
                          {t("status.OFFLINE")}
                        </SelectItem>
                        <SelectItem value="PENDING">
                          {t("status.PENDING")}
                        </SelectItem>
                        <SelectItem value="RETIRED">
                          {t("status.RETIRED")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={platformFilter}
                      onValueChange={setPlatformFilter}
                    >
                      <SelectTrigger className="w-[150px]">
                        <SelectValue
                          placeholder={t("filters.platform.label")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {t("filters.platform.all")}
                        </SelectItem>
                        <SelectItem value="MACOS">
                          {t("platform.MACOS")}
                        </SelectItem>
                        <SelectItem value="WINDOWS">
                          {t("platform.WINDOWS")}
                        </SelectItem>
                        <SelectItem value="LINUX">
                          {t("platform.LINUX")}
                        </SelectItem>
                        <SelectItem value="IOS">{t("platform.IOS")}</SelectItem>
                        <SelectItem value="ANDROID">
                          {t("platform.ANDROID")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={loadData}
                      disabled={isPending}
                    >
                      <RefreshCw
                        className={cn("h-4 w-4", isPending && "animate-spin")}
                      />
                    </Button>
                  </div>
                </div>

                {/* Device table */}
                <DevicesTable
                  devices={devices}
                  isPending={isPending}
                  onShowInstallGuide={() => setShowInstallGuide(true)}
                />
              </TabsContent>

              {/* Shadow IT tab */}
              <TabsContent value="shadow-it" className="mt-4 space-y-4">
                <ShadowITTable
                  shadowITApps={shadowITApps}
                  role={role}
                  isPending={isPending}
                  onApprove={handleApproveShadowIT}
                />
              </TabsContent>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Install guide sheet */}
      <Sheet open={showInstallGuide} onOpenChange={setShowInstallGuide}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto sm:w-[500px] sm:max-w-[500px]"
        >
          <SheetHeader>
            <SheetTitle>{t("installGuide.title")}</SheetTitle>
          </SheetHeader>
          <FleetDMInstallGuide onClose={() => setShowInstallGuide(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
