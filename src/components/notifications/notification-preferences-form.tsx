// src/components/notifications/notification-preferences-form.tsx
"use client";

/**
 * Per-user notification preferences (7.1): event type × channel grid grouped
 * by area with contextual help, digest opt-in and personal reminder lead days.
 */
import { updateNotificationPreferences } from "@/actions/notifications/preferences";
import { HelpHint } from "@/components/common/help-hint";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  NOTIFICATION_TYPE_GROUPS,
  type NotificationPreferenceCell,
  type NotificationPreferenceMatrix,
  type NotificationTypeGroup,
} from "@/types/notification";
import type {
  NotificationChannel,
  NotificationEventType,
} from "@prisma/client";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { TYPE_GROUP_META } from "./notification-type-groups";

export interface NotificationPreferencesFormProps {
  initial: NotificationPreferenceMatrix;
}

const GRID_GROUPS: NotificationTypeGroup[] = [
  "renewals",
  "approvals",
  "priceChanges",
  "security",
];
const DIGEST_TYPE: NotificationEventType = "DIGEST";
const DIGEST_CHANNEL: NotificationChannel = "EMAIL";

const cellKey = (type: NotificationEventType, channel: NotificationChannel) =>
  `${type}:${channel}`;

export function NotificationPreferencesForm({
  initial,
}: NotificationPreferencesFormProps) {
  const t = useTranslations("notifications.preferences");
  const tGroups = useTranslations("notifications.groups");
  const tEvents = useTranslations("notifications.events");
  const tChannels = useTranslations("notifications.channels");
  const [isPending, startTransition] = useTransition();
  const [matrix, setMatrix] = useState(initial);
  const enabledMap = useMemo(
    () =>
      new Map(
        matrix.cells.map((c) => [cellKey(c.eventType, c.channel), c.enabled])
      ),
    [matrix.cells]
  );

  function persistCell(cell: NotificationPreferenceCell) {
    const previous = matrix;
    setMatrix((m) => ({
      ...m,
      cells: m.cells.map((c) =>
        c.eventType === cell.eventType && c.channel === cell.channel ? cell : c
      ),
    }));
    startTransition(async () => {
      const res = await updateNotificationPreferences({ cells: [cell] });
      if (res.success && res.data) {
        setMatrix(res.data);
      } else {
        setMatrix(previous);
        toast.error(res.error ?? t("toast.failed"));
      }
    });
  }

  function persistLeadDays(next: number[]) {
    const previous = matrix;
    setMatrix((m) => ({ ...m, reminderLeadDays: next }));
    startTransition(async () => {
      const res = await updateNotificationPreferences({
        reminderLeadDays: next,
      });
      if (res.success && res.data) {
        setMatrix(res.data);
        toast.success(t("toast.leadDaysSaved"));
      } else {
        setMatrix(previous);
        toast.error(res.error ?? t("toast.failed"));
      }
    });
  }

  const digestOn = enabledMap.get(cellKey(DIGEST_TYPE, DIGEST_CHANNEL)) ?? true;
  const digestAvailable = matrix.channels.includes(DIGEST_CHANNEL);

  return (
    <div className="space-y-8">
      {/* Grid */}
      <section aria-labelledby="pref-grid-heading" className="space-y-3">
        <header className="flex items-center justify-between gap-3">
          <div>
            <h2
              id="pref-grid-heading"
              className="text-base font-semibold tracking-tight"
            >
              {t("grid.title")}
            </h2>
            <p className="text-muted-foreground text-sm">
              {t("grid.description")}
            </p>
          </div>
          {isPending && (
            <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
              <Loader2
                className="h-3.5 w-3.5 animate-spin"
                aria-hidden="true"
              />
              {t("saving")}
            </span>
          )}
        </header>

        <div className="bg-card overflow-hidden rounded-xl border shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground text-left text-xs tracking-wide uppercase">
                <th scope="col" className="px-4 py-2.5 font-medium">
                  {t("grid.event")}
                </th>
                {matrix.channels.map((channel) => (
                  <th
                    key={channel}
                    scope="col"
                    className="w-28 px-3 py-2.5 text-center font-medium"
                  >
                    {tChannels(channel)}
                  </th>
                ))}
              </tr>
            </thead>
            {GRID_GROUPS.map((group) => {
              const meta = TYPE_GROUP_META[group];
              const Icon = meta.icon;
              return (
                <tbody key={group} className="border-t">
                  <tr>
                    <th
                      scope="rowgroup"
                      colSpan={matrix.channels.length + 1}
                      className="bg-background px-4 pt-3 pb-1 text-left"
                    >
                      <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
                        <span
                          className={cn(
                            "flex h-5 w-5 items-center justify-center rounded-md",
                            meta.iconClass
                          )}
                        >
                          <Icon className="h-3 w-3" aria-hidden="true" />
                        </span>
                        {tGroups(meta.labelKey)}
                      </span>
                    </th>
                  </tr>
                  {NOTIFICATION_TYPE_GROUPS[group].map((eventType) => (
                    <tr
                      key={eventType}
                      className="hover:bg-accent/40 transition-colors"
                    >
                      <td className="px-4 py-2">
                        <span className="inline-flex items-center gap-1.5">
                          {tEvents(`${eventType}.label`)}
                          <HelpHint
                            title={tEvents(`${eventType}.label`)}
                            content={tEvents(`${eventType}.help`)}
                            label={t("grid.helpFor", {
                              event: tEvents(`${eventType}.label`),
                            })}
                          />
                        </span>
                      </td>
                      {matrix.channels.map((channel) => {
                        const enabled =
                          enabledMap.get(cellKey(eventType, channel)) ?? true;
                        return (
                          <td key={channel} className="px-3 py-2 text-center">
                            <Switch
                              checked={enabled}
                              disabled={isPending}
                              aria-label={t("grid.toggleLabel", {
                                event: tEvents(`${eventType}.label`),
                                channel: tChannels(channel),
                              })}
                              onCheckedChange={(checked) =>
                                persistCell({
                                  eventType,
                                  channel,
                                  enabled: checked,
                                })
                              }
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              );
            })}
          </table>
        </div>
      </section>

      {/* Digest */}
      <section
        aria-labelledby="pref-digest-heading"
        className="bg-card flex items-start justify-between gap-4 rounded-xl border p-4 shadow-sm"
      >
        <div className="space-y-1">
          <h2
            id="pref-digest-heading"
            className="inline-flex items-center gap-1.5 text-base font-semibold tracking-tight"
          >
            {t("digest.title")}
            <HelpHint
              content={t("digest.help")}
              href="/settings/notifications"
            />
          </h2>
          <p className="text-muted-foreground text-sm">
            {digestAvailable
              ? t("digest.description")
              : t("digest.unavailable")}
          </p>
        </div>
        <Switch
          checked={digestAvailable && digestOn}
          disabled={isPending || !digestAvailable}
          aria-label={t("digest.title")}
          onCheckedChange={(checked) =>
            persistCell({
              eventType: DIGEST_TYPE,
              channel: DIGEST_CHANNEL,
              enabled: checked,
            })
          }
        />
      </section>

      {/* Reminder lead days */}
      <section
        aria-labelledby="pref-lead-heading"
        className="bg-card space-y-3 rounded-xl border p-4 shadow-sm"
      >
        <div className="space-y-1">
          <h2
            id="pref-lead-heading"
            className="inline-flex items-center gap-1.5 text-base font-semibold tracking-tight"
          >
            {t("leadDays.title")}
            <HelpHint content={t("leadDays.help")} />
          </h2>
          <p className="text-muted-foreground text-sm">
            {t("leadDays.description", {
              defaults: matrix.organizationDefaultLeadDays.join(", "),
            })}
          </p>
        </div>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={t("leadDays.title")}
        >
          {matrix.reminderLeadDayOptions.map((day) => {
            const active = matrix.reminderLeadDays.includes(day);
            return (
              <Button
                key={day}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                aria-pressed={active}
                disabled={isPending}
                className="rounded-full font-mono tabular-nums"
                onClick={() =>
                  persistLeadDays(
                    active
                      ? matrix.reminderLeadDays.filter((d) => d !== day)
                      : [...matrix.reminderLeadDays, day]
                  )
                }
              >
                {t("leadDays.option", { days: day })}
              </Button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
