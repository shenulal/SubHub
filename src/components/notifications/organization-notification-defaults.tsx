// src/components/notifications/organization-notification-defaults.tsx
"use client";

/**
 * Admin section of /settings/notifications (settings:manage): digest schedule,
 * cost-anomaly threshold, quiet hours and approver copy live on the settings
 * registry; the remaining scan toggles stay on the legacy organisation JSON.
 */
import {
  updateOrganizationNotificationDefaults,
  type OrganizationNotificationDefaults,
} from "@/actions/notifications/org-defaults";
import { HelpHint } from "@/components/common/help-hint";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { WEEKDAYS } from "@/lib/settings/registry";
import type { OrganizationNotificationDefaultsInput } from "@/lib/validations/notifications";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

export interface OrganizationNotificationDefaultsProps {
  initial: OrganizationNotificationDefaults;
}

const THRESHOLD_MIN = 1;
const THRESHOLD_MAX = 500;

export function OrganizationNotificationDefaultsForm({
  initial,
}: OrganizationNotificationDefaultsProps) {
  const t = useTranslations("notifications.orgDefaults");
  const [values, setValues] = useState(initial);
  const [isPending, startTransition] = useTransition();

  function save(patch: OrganizationNotificationDefaultsInput) {
    const previous = values;
    setValues((v) => ({ ...v, ...patch }) as OrganizationNotificationDefaults);
    startTransition(async () => {
      const res = await updateOrganizationNotificationDefaults(patch);
      if (res.success && res.data) {
        setValues(res.data);
        toast.success(t("toast.saved"));
      } else {
        setValues(previous);
        toast.error(res.error ?? t("toast.failed"));
      }
    });
  }

  return (
    <section aria-labelledby="org-defaults-heading" className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2
            id="org-defaults-heading"
            className="text-base font-semibold tracking-tight"
          >
            {t("title")}
          </h2>
          <p className="text-muted-foreground text-sm">{t("description")}</p>
        </div>
        {isPending && (
          <Loader2
            className="text-muted-foreground h-4 w-4 animate-spin"
            aria-label={t("saving")}
          />
        )}
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Digest schedule */}
        <Card title={t("digest.title")} help={t("digest.help")}>
          <Row label={t("digest.enabled")} htmlFor="digest-enabled">
            <Switch
              id="digest-enabled"
              checked={values.digestEnabled}
              disabled={isPending}
              onCheckedChange={(checked) => save({ digestEnabled: checked })}
            />
          </Row>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="digest-weekday">{t("digest.weekday")}</Label>
              <Select
                value={String(values.digestWeekday)}
                disabled={isPending || !values.digestEnabled}
                onValueChange={(v) => save({ digestWeekday: Number(v) })}
              >
                <SelectTrigger id="digest-weekday">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((d) => (
                    <SelectItem key={d.value} value={String(d.value)}>
                      {t(`weekdays.${d.value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="digest-time">{t("digest.time")}</Label>
              <Input
                id="digest-time"
                type="time"
                step={60}
                value={values.digestTime}
                disabled={isPending || !values.digestEnabled}
                onChange={(e) =>
                  e.target.value && save({ digestTime: e.target.value })
                }
              />
            </div>
          </div>
        </Card>

        {/* Quiet hours */}
        <Card title={t("quiet.title")} help={t("quiet.help")}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="quiet-start">{t("quiet.start")}</Label>
              <Input
                id="quiet-start"
                type="time"
                value={values.quietHoursStart ?? ""}
                disabled={isPending}
                onChange={(e) =>
                  save({ quietHoursStart: e.target.value || null })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quiet-end">{t("quiet.end")}</Label>
              <Input
                id="quiet-end"
                type="time"
                value={values.quietHoursEnd ?? ""}
                disabled={isPending}
                onChange={(e) =>
                  save({ quietHoursEnd: e.target.value || null })
                }
              />
            </div>
          </div>
          <p className="text-muted-foreground text-xs">{t("quiet.hint")}</p>
        </Card>

        {/* Cost anomaly */}
        <Card title={t("cost.title")} help={t("cost.help")}>
          <Row label={t("cost.enabled")} htmlFor="cost-enabled">
            <Switch
              id="cost-enabled"
              checked={values.costAnomalyAlerts}
              disabled={isPending}
              onCheckedChange={(checked) =>
                save({ costAnomalyAlerts: checked })
              }
            />
          </Row>
          <div className="flex items-center gap-3">
            <Label htmlFor="cost-threshold" className="whitespace-nowrap">
              {t("cost.threshold")}
            </Label>
            <Input
              id="cost-threshold"
              type="number"
              min={THRESHOLD_MIN}
              max={THRESHOLD_MAX}
              className="w-24 font-mono tabular-nums"
              value={values.costAnomalyThresholdPercent}
              disabled={isPending || !values.costAnomalyAlerts}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (n >= THRESHOLD_MIN && n <= THRESHOLD_MAX) {
                  save({ costAnomalyThresholdPercent: n });
                }
              }}
            />
            <span className="text-muted-foreground text-sm">%</span>
          </div>
        </Card>

        {/* Security scans + approver copy */}
        <Card title={t("scans.title")} help={t("scans.help")}>
          <Row label={t("scans.offboarding")} htmlFor="scan-offboarding">
            <Switch
              id="scan-offboarding"
              checked={values.offboardingAlerts}
              disabled={isPending}
              onCheckedChange={(checked) =>
                save({ offboardingAlerts: checked })
              }
            />
          </Row>
          <Row label={t("scans.shadowIT")} htmlFor="scan-shadow">
            <Switch
              id="scan-shadow"
              checked={values.shadowITAlerts}
              disabled={isPending}
              onCheckedChange={(checked) => save({ shadowITAlerts: checked })}
            />
          </Row>
          <Row label={t("scans.copyApprovers")} htmlFor="copy-approvers">
            <Switch
              id="copy-approvers"
              checked={values.copyApproversOnRenewal}
              disabled={isPending}
              onCheckedChange={(checked) =>
                save({ copyApproversOnRenewal: checked })
              }
            />
          </Row>
        </Card>
      </div>
    </section>
  );
}

interface CardProps {
  title: string;
  help: string;
  children: React.ReactNode;
}

function Card({ title, help, children }: CardProps) {
  return (
    <div className="bg-card space-y-3 rounded-xl border p-4 shadow-sm">
      <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold">
        {title}
        <HelpHint content={help} />
      </h3>
      {children}
    </div>
  );
}

interface RowProps {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}

function Row({ label, htmlFor, children }: RowProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={htmlFor} className="text-sm font-normal">
        {label}
      </Label>
      {children}
    </div>
  );
}
