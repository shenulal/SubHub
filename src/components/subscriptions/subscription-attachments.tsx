"use client";

/**
 * Documents tab: drag-and-drop upload (multipart to the REST route) and a list
 * with kind badge, size, uploader, date, download and delete.
 */
import {
  deleteAttachment,
  listAttachments,
  type AttachmentItem,
} from "@/actions/subscriptions";
import { Can } from "@/components/common/can";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { AttachmentKind } from "@prisma/client";
import { Download, FileText, Loader2, Trash2, UploadCloud } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { formatDate } from "./subscription-detail.utils";

interface SubscriptionAttachmentsProps {
  subscriptionId: string;
  maxSizeMb: number;
  allowedMimeTypes: string[];
}

const KINDS: AttachmentKind[] = ["CONTRACT", "INVOICE", "ORDER_FORM", "OTHER"];
const BYTES_PER_KB = 1024;

export function formatBytes(bytes: number): string {
  if (bytes < BYTES_PER_KB) return `${bytes} B`;
  if (bytes < BYTES_PER_KB * BYTES_PER_KB)
    return `${(bytes / BYTES_PER_KB).toFixed(0)} KB`;
  return `${(bytes / (BYTES_PER_KB * BYTES_PER_KB)).toFixed(1)} MB`;
}

const KIND_TONE: Record<AttachmentKind, string> = {
  CONTRACT: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  INVOICE: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  ORDER_FORM: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  OTHER: "bg-muted text-muted-foreground",
};

export function SubscriptionAttachments({
  subscriptionId,
  maxSizeMb,
  allowedMimeTypes,
}: SubscriptionAttachmentsProps) {
  const t = useTranslations("lifecycle.attachments");
  const [items, setItems] = useState<AttachmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [kind, setKind] = useState<AttachmentKind>("OTHER");
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    const result = await listAttachments(subscriptionId);
    if (result.success && result.data) setItems(result.data);
    setIsLoading(false);
  }, [subscriptionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const upload = async (file: File) => {
    setIsUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", kind);
      const response = await fetch(
        `/api/v1/subscriptions/${subscriptionId}/attachments`,
        { method: "POST", body: form, credentials: "include" }
      );
      const body = (await response.json()) as {
        success: boolean;
        error?: string;
      };
      if (!response.ok || !body.success) {
        toast.error(body.error ?? t("uploadFailed"));
        return;
      }
      toast.success(t("uploaded"));
      await load();
    } catch {
      toast.error(t("uploadFailed"));
    } finally {
      setIsUploading(false);
    }
  };

  const remove = async (item: AttachmentItem) => {
    if (!window.confirm(t("deleteConfirm", { name: item.fileName }))) return;
    const result = await deleteAttachment(item.id);
    if (!result.success) {
      toast.error(result.error ?? t("uploadFailed"));
      return;
    }
    toast.success(t("deleted"));
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  };

  const accept = allowedMimeTypes.join(",");

  return (
    <Card className="border-border/50 rounded-sm shadow-sm">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <Can permission="attachments:upload">
          <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) void upload(file);
              }}
              disabled={isUploading}
              className={cn(
                "flex min-h-28 flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-6 text-sm transition-colors",
                "border-border bg-muted/30 text-muted-foreground hover:border-primary/50 hover:bg-muted/60",
                isDragging && "border-primary bg-primary/5 text-foreground"
              )}
            >
              {isUploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <UploadCloud className="h-5 w-5" />
              )}
              <span>{isUploading ? t("uploading") : t("dropzone")}</span>
              <span className="text-xs opacity-70">
                {t("limits", {
                  maxMb: maxSizeMb,
                  types: allowedMimeTypes
                    .map((m) => m.split("/").pop())
                    .join(", "),
                })}
              </span>
            </button>
            <div className="space-y-2">
              <span className="text-muted-foreground text-xs font-medium">
                {t("kind")}
              </span>
              <Select
                value={kind}
                onValueChange={(v) => setKind(v as AttachmentKind)}
              >
                <SelectTrigger aria-label={t("kind")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {t(`kinds.${k}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept={accept}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
                e.target.value = "";
              }}
            />
          </div>
        </Can>

        {isLoading ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("empty")}</p>
        ) : (
          <ul className="divide-border divide-y rounded-md border">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 px-3 py-2.5 text-sm"
              >
                <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.fileName}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatBytes(item.sizeBytes)}
                    {" · "}
                    {t("uploadedBy", {
                      name:
                        item.uploadedBy?.name ?? item.uploadedBy?.email ?? "—",
                      date: formatDate(item.createdAt),
                    })}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn("border-transparent", KIND_TONE[item.kind])}
                >
                  {t(`kinds.${item.kind}`)}
                </Badge>
                {item.downloadUrl && (
                  <Button variant="ghost" size="icon" asChild>
                    <a
                      href={item.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={t("download")}
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                )}
                <Can permission="attachments:delete">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("delete")}
                    onClick={() => void remove(item)}
                  >
                    <Trash2 className="text-destructive h-4 w-4" />
                  </Button>
                </Can>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
