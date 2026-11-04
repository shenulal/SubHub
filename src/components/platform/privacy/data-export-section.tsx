"use client";

import { requestDataExport } from "@/actions/platform/privacy";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DataExportRow } from "@/types/platform";
import { Download, FileArchive, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

interface DataExportSectionProps {
  exports: DataExportRow[];
  expiryHours: number;
}

const BYTES_PER_KB = 1024;

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < BYTES_PER_KB) return `${bytes} B`;
  if (bytes < BYTES_PER_KB ** 2)
    return `${(bytes / BYTES_PER_KB).toFixed(1)} KB`;
  return `${(bytes / BYTES_PER_KB ** 2).toFixed(1)} MB`;
}

const STATUS_STYLES: Record<DataExportRow["status"], string> = {
  READY: "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
  PENDING: "border-amber-500/40 text-amber-700 dark:text-amber-400",
  FAILED: "border-destructive/40 text-destructive",
  EXPIRED: "text-muted-foreground",
};

export function DataExportSection({
  exports,
  expiryHours,
}: DataExportSectionProps) {
  const t = useTranslations("platform.privacy");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const request = () => {
    startTransition(async () => {
      const result = await requestDataExport();
      if (result.success) {
        toast.success(t("exportReady"));
        router.refresh();
      } else toast.error(result.error ?? t("exportFailed"));
    });
  };

  return (
    <section className="rounded-lg border p-6">
      <div className="flex items-start gap-4">
        <div className="bg-primary/10 rounded-lg p-2.5">
          <FileArchive className="text-primary h-5 w-5" />
        </div>
        <div className="flex-1 space-y-4">
          <div>
            <h3 className="text-lg font-semibold">{t("exportTitle")}</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              {t("exportDescription", { hours: expiryHours })}
            </p>
          </div>
          <Button onClick={request} disabled={isPending}>
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {isPending ? t("preparing") : t("requestExport")}
          </Button>

          {exports.length > 0 && (
            <ul className="divide-y rounded-md border">
              {exports.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn("font-normal", STATUS_STYLES[row.status])}
                      >
                        {t(`status.${row.status}`)}
                      </Badge>
                      <span className="text-muted-foreground text-xs">
                        {new Date(row.requestedAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {row.format} · {formatBytes(row.sizeBytes)}
                      {row.expiresAt &&
                        row.status === "READY" &&
                        ` · ${t("expires", { date: new Date(row.expiresAt).toLocaleString() })}`}
                      {row.errorMessage && ` · ${row.errorMessage}`}
                    </div>
                  </div>
                  {row.downloadUrl && (
                    <Button asChild variant="outline" size="sm">
                      <a href={row.downloadUrl} download>
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        {t("download")}
                      </a>
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
