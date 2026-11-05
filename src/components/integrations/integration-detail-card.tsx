// src/components/integrations/integration-detail-card.tsx
"use client";

import { syncIntegrationNow } from "@/actions/integrations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatKoreanDateTime } from "@/lib/date";
import { Link2, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export interface IntegrationDetailProps {
  id: string;
  type: "GOOGLE_WORKSPACE" | "OKTA" | "MICROSOFT_ENTRA" | "HR_SYSTEM";
  status: "PENDING" | "ACTIVE" | "ERROR" | "DISCONNECTED";
  lastSyncAt: string | null;
  lastError: string | null;
  syncCount: number;
  lastSyncResult?: {
    status: "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED";
    itemsFound: number;
    itemsCreated: number;
    itemsUpdated: number;
    errors: Array<{ code: string; message: string }>;
  };
  metadata: {
    domain?: string;
    autoSync?: boolean;
    syncInterval?: "hourly" | "daily" | "weekly";
    [key: string]: unknown;
  };
  createdAt: string;
  updatedAt: string;
}

interface IntegrationDetailCardProps {
  integration: IntegrationDetailProps;
  canManage?: boolean;
}

function getIntegrationTypeName(
  type: IntegrationDetailProps["type"],
  t: (key: string) => string
): string {
  const typeNames: Record<IntegrationDetailProps["type"], string> = {
    GOOGLE_WORKSPACE: t("integrations.type.googleWorkspace"),
    OKTA: t("integrations.type.okta"),
    MICROSOFT_ENTRA: t("integrations.type.microsoftEntra"),
    HR_SYSTEM: t("integrations.type.hrSystem"),
  };
  return typeNames[type] || type;
}

function getStatusBadge(
  status: IntegrationDetailProps["status"],
  t: (key: string) => string
) {
  const statusConfig: Record<
    IntegrationDetailProps["status"],
    {
      label: string;
      variant: "success" | "warning" | "secondary" | "error";
    }
  > = {
    ACTIVE: { label: t("integrations.status.active"), variant: "success" },
    PENDING: { label: t("integrations.status.pending"), variant: "warning" },
    ERROR: {
      label: t("integrations.status.error"),
      variant: "error",
    },
    DISCONNECTED: {
      label: t("integrations.status.disconnected"),
      variant: "secondary",
    },
  };
  const config = statusConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function IntegrationDetailCard({
  integration,
  canManage = true,
}: IntegrationDetailCardProps) {
  const t = useTranslations();
  const router = useRouter();
  const [isSyncing, startSyncTransition] = useTransition();

  const handleSync = () => {
    startSyncTransition(async () => {
      try {
        await syncIntegrationNow(integration.id);
        router.refresh();
      } catch (error) {
        console.error(t("integrations.sync.errorLog"), error);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="tonal-primary flex size-12 shrink-0 items-center justify-center rounded-md">
              <Link2 className="size-6" />
            </div>
            <div className="min-w-0">
              <CardTitle className="flex min-w-0 items-center gap-2">
                <span className="truncate">
                  {getIntegrationTypeName(integration.type, t)}
                </span>
                {getStatusBadge(integration.status, t)}
              </CardTitle>
              {integration.metadata.domain && (
                <p className="text-muted-foreground truncate text-[0.8125rem]">
                  {integration.metadata.domain}
                </p>
              )}
            </div>
          </div>
          <Button
            className="shrink-0"
            variant="outline"
            onClick={handleSync}
            disabled={
              !canManage ||
              isSyncing ||
              !["ACTIVE", "PENDING"].includes(integration.status)
            }
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`}
            />
            {isSyncing
              ? t("integrations.actions.syncing")
              : t("integrations.actions.sync")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2">
          {/* 동기화 정보 */}
          <div className="min-w-0 space-y-4">
            <div className="min-w-0">
              <p className="text-muted-foreground truncate text-[0.8125rem]">
                {t("integrations.detail.lastSync")}
              </p>
              <p className="text-foreground truncate font-medium tabular-nums">
                {integration.lastSyncAt
                  ? formatKoreanDateTime(integration.lastSyncAt)
                  : "-"}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground truncate text-[0.8125rem]">
                {t("integrations.detail.totalSyncCount")}
              </p>
              <p className="text-foreground font-medium tabular-nums">
                {integration.syncCount}
              </p>
            </div>
          </div>

          {/* 마지막 동기화 결과 */}
          {integration.lastSyncResult && (
            <div className="min-w-0 space-y-4">
              <p className="text-muted-foreground text-[0.8125rem]">
                {t("integrations.detail.lastSyncResult")}
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-muted min-w-0 rounded-md p-3 text-center">
                  <p className="text-muted-foreground truncate text-xs">
                    {t("integrations.detail.itemsFound")}
                  </p>
                  <p className="text-foreground truncate text-2xl font-medium tabular-nums">
                    {integration.lastSyncResult.itemsFound}
                  </p>
                </div>
                <div className="bg-muted min-w-0 rounded-md p-3 text-center">
                  <p className="text-muted-foreground truncate text-xs">
                    {t("integrations.detail.itemsCreated")}
                  </p>
                  <p className="text-success truncate text-2xl font-medium tabular-nums">
                    {integration.lastSyncResult.itemsCreated}
                  </p>
                </div>
                <div className="bg-muted min-w-0 rounded-md p-3 text-center">
                  <p className="text-muted-foreground truncate text-xs">
                    {t("integrations.detail.itemsUpdated")}
                  </p>
                  <p className="text-info truncate text-2xl font-medium tabular-nums">
                    {integration.lastSyncResult.itemsUpdated}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 오류 메시지 */}
        {integration.lastError && (
          <div className="tonal-error mt-4 rounded-md px-4 py-3">
            <p className="text-sm font-medium">
              {t("integrations.detail.error")}
            </p>
            <p className="text-sm break-words">{integration.lastError}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
