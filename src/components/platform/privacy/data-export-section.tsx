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
  READY: "tonal-success border-transparent",
  PENDING: "tonal-warning border-transparent",
  FAILED: "tonal-error border-transparent",
  EXPIRED: "tonal-neutral border-transparent",
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
    <section className="rounded-md border p-5">
      <div className="flex min-w-0 items-start gap-4">
        <div className="tonal-primary flex size-10 shrink-0 items-center justify-center rounded-md">
          <FileArchive className="size-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-4">
          <div className="space-y-1">
            <h3 className="text-foreground text-lg leading-snug font-medium">
              {t("exportTitle")}
            </h3>
            <p className="text-muted-foreground text-[0.8125rem]">
              {t("exportDescription", { hours: expiryHours })}
            </p>
          </div>
          <Button onClick={request} disabled={isPending} className="shrink-0">
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {isPending ? t("preparing") : t("requestExport")}
          </Button>

          {exports.length > 0 && (
            <ul className="divide-y rounded-md border">
              {exports.map((row) => (
                <li
                  key={row.id}
                  className="flex min-w-0 flex-wrap items-center justify-between gap-3 px-4 py-3 text-[0.9375rem]"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn("font-medium", STATUS_STYLES[row.status])}
                      >
                        {t(`status.${row.status}`)}
                      </Badge>
                      <span className="text-muted-foreground text-[0.8125rem]">
                        {new Date(row.requestedAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-muted-foreground text-[0.8125rem] break-words">
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
                        <Download className="size-3.5" />
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
