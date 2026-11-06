// src/components/devices/shadow-it-table.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ShadowITAppSummary } from "@/lib/services/fleetdm";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { useTranslations } from "next-intl";

interface ShadowITTableProps {
  shadowITApps: ShadowITAppSummary[];
  canManage?: boolean;
  isPending: boolean;
  onApprove: (appName: string, approve: boolean) => void;
}

export function ShadowITTable({
  shadowITApps,
  canManage = false,
  isPending,
  onApprove,
}: ShadowITTableProps) {
  const t = useTranslations("devices.shadowIT");
  return (
    <div className="rounded-md border p-4">
      <div className="text-foreground flex items-center gap-3 font-medium">
        <span className="tonal-warning flex size-8 shrink-0 items-center justify-center rounded-md">
          <AlertTriangle className="size-[18px]" />
        </span>
        {t("title")}
      </div>
      <div className="mt-4">
        {shadowITApps.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-3 py-8 text-center">
            <span className="tonal-success flex size-12 items-center justify-center rounded-md">
              <CheckCircle className="size-[22px]" />
            </span>
            <p className="text-[0.9375rem]">{t("empty")}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("headers.appName")}</TableHead>
                <TableHead>{t("headers.deviceCount")}</TableHead>
                <TableHead className="text-right">
                  {t("headers.actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shadowITApps.map((app) => (
                <TableRow key={app.name}>
                  <TableCell className="text-foreground max-w-[280px] truncate font-medium">
                    {app.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="error">
                      {t("deviceCount", { count: app.deviceCount })}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {canManage && (
                      <div className="flex justify-end gap-2 whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onApprove(app.name, true)}
                          disabled={isPending}
                        >
                          {t("actions.approve")}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => onApprove(app.name, false)}
                          disabled={isPending}
                        >
                          {t("actions.block")}
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
