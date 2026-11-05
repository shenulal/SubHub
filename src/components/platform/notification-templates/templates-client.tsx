"use client";

import {
  resetNotificationTemplate,
  setNotificationTemplateActive,
  upsertNotificationTemplate,
} from "@/actions/platform/notification-templates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { renderTemplate } from "@/lib/services/notification/template-render";
import { cn } from "@/lib/utils";
import type { NotificationTemplateRow } from "@/types/platform";
import {
  Loader2,
  Mail,
  MonitorSmartphone,
  Pencil,
  RotateCcw,
  Smartphone,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

interface TemplatesClientProps {
  rows: NotificationTemplateRow[];
}

const CHANNEL_ICON = {
  IN_APP: MonitorSmartphone,
  EMAIL: Mail,
  PUSH: Smartphone,
} as const;
const PREVIEW_SAMPLE = "…";

function sampleVars(placeholders: string[]): Record<string, string> {
  return Object.fromEntries(placeholders.map((p) => [p, `[${p}]`]));
}

function TemplateEditor({
  row,
  onClose,
}: {
  row: NotificationTemplateRow;
  onClose: () => void;
}) {
  const t = useTranslations("platform.templates");
  const router = useRouter();
  const [subject, setSubject] = useState(row.subject);
  const [body, setBody] = useState(row.body);
  const [isActive, setIsActive] = useState(row.isActive);
  const [isPending, startTransition] = useTransition();
  const preview = useMemo(
    () => renderTemplate({ subject, body }, sampleVars(row.placeholders)),
    [subject, body, row.placeholders]
  );

  const save = () => {
    startTransition(async () => {
      const result = await upsertNotificationTemplate({
        eventType: row.eventType,
        channel: row.channel,
        locale: row.locale,
        subject,
        body,
        isActive,
      });
      if (result.success) {
        toast.success(t("saved"));
        onClose();
        router.refresh();
      } else toast.error(result.error ?? t("saveFailed"));
    });
  };

  const insert = (placeholder: string) =>
    setBody(
      (b) =>
        `${b}${b.endsWith(" ") || b.length === 0 ? "" : " "}{{${placeholder}}}`
    );

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>
          {t("editTitle", { event: row.eventType, channel: row.channel })}
        </DialogTitle>
        <DialogDescription>{t("editDescription")}</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="tpl-subject">{t("subject")}</Label>
          <Input
            id="tpl-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tpl-body">{t("body")}</Label>
          <Textarea
            id="tpl-body"
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="font-mono text-xs"
          />
        </div>
        <div>
          <p className="text-muted-foreground mb-1.5 text-xs">
            {t("placeholdersHelp")}
          </p>
          <div className="flex flex-wrap gap-1">
            {row.placeholders.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => insert(p)}
                className="tonal-neutral hover:tonal-primary rounded px-2 py-0.5 font-mono text-xs transition-colors"
              >
                {`{{${p}}}`}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-muted rounded-md p-4 text-[0.9375rem]">
          <p className="text-muted-foreground mb-1.5 text-xs font-medium tracking-wide uppercase">
            {t("preview")}
          </p>
          <p className="font-medium">{preview.subject || PREVIEW_SAMPLE}</p>
          <p className="text-muted-foreground mt-1 whitespace-pre-wrap">
            {preview.body}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={isActive} onCheckedChange={setIsActive} />
          {t("activeOverride")}
        </label>
      </div>
      <DialogFooter className="gap-3">
        <Button variant="outline" onClick={onClose}>
          {t("cancel")}
        </Button>
        <Button onClick={save} disabled={isPending || !body.trim()}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {t("save")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function TemplatesClient({ rows }: TemplatesClientProps) {
  const t = useTranslations("platform.templates");
  const router = useRouter();
  const [editing, setEditing] = useState<NotificationTemplateRow | null>(null);
  const [isPending, startTransition] = useTransition();

  const byEvent = useMemo(() => {
    const map = new Map<string, NotificationTemplateRow[]>();
    for (const row of rows)
      (map.get(row.eventType) ??
        map.set(row.eventType, []).get(row.eventType))!.push(row);
    return Array.from(map.entries());
  }, [rows]);

  const run = (
    fn: () => Promise<{ success: boolean; error?: string }>,
    ok: string
  ) =>
    startTransition(async () => {
      const result = await fn();
      if (result.success) {
        toast.success(ok);
        router.refresh();
      } else toast.error(result.error ?? t("saveFailed"));
    });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-foreground text-lg leading-snug font-medium">
          {t("title")}
        </h3>
        <p className="text-muted-foreground text-[0.8125rem]">
          {t("description")}
        </p>
      </div>
      <div className="space-y-4">
        {byEvent.map(([event, channels]) => (
          <section key={event} className="overflow-hidden rounded-md border">
            <header className="bg-muted flex min-w-0 items-center justify-between gap-3 border-b px-4 py-2.5">
              <h4
                className="text-foreground min-w-0 truncate font-mono text-[0.8125rem] font-medium tracking-wide"
                title={event}
              >
                {event}
              </h4>
              <span className="text-muted-foreground shrink-0 text-xs">
                {t("customCount", {
                  count: channels.filter((c) => c.source === "custom").length,
                })}
              </span>
            </header>
            <ul className="divide-y">
              {channels.map((row) => {
                const Icon = CHANNEL_ICON[row.channel];
                const key = {
                  eventType: row.eventType,
                  channel: row.channel,
                  locale: row.locale,
                };
                return (
                  <li
                    key={row.channel}
                    className={cn(
                      "grid min-w-0 items-center gap-3 px-4 py-3 sm:grid-cols-[8rem_minmax(0,1fr)_auto]",
                      !row.isActive && "opacity-60"
                    )}
                  >
                    <span className="text-foreground flex min-w-0 items-center gap-2 text-[0.8125rem] font-medium">
                      <span className="tonal-primary flex size-7 shrink-0 items-center justify-center rounded-md">
                        <Icon className="size-4" />
                      </span>
                      <span className="truncate">{row.channel}</span>
                    </span>
                    <div className="min-w-0">
                      <p className="text-foreground truncate text-[0.9375rem]">
                        {row.subject || (
                          <span className="text-muted-foreground italic">
                            {t("noSubject")}
                          </span>
                        )}
                      </p>
                      <p className="text-muted-foreground truncate text-[0.8125rem]">
                        {row.body}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Badge
                        variant={
                          row.source === "custom" ? "primary" : "secondary"
                        }
                        className="shrink-0 text-xs"
                      >
                        {row.source === "custom" ? t("custom") : t("default")}
                      </Badge>
                      {row.source === "custom" && (
                        <>
                          <Switch
                            checked={row.isActive}
                            disabled={isPending}
                            aria-label={t("activeOverride")}
                            onCheckedChange={(v) =>
                              run(
                                () => setNotificationTemplateActive(key, v),
                                v ? t("enabled") : t("disabled")
                              )
                            }
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={t("reset")}
                            disabled={isPending}
                            onClick={() =>
                              run(
                                () => resetNotificationTemplate(key),
                                t("resetDone")
                              )
                            }
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={t("edit")}
                        onClick={() => setEditing(row)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        {editing && (
          <TemplateEditor
            key={`${editing.eventType}:${editing.channel}`}
            row={editing}
            onClose={() => setEditing(null)}
          />
        )}
      </Dialog>
    </div>
  );
}
