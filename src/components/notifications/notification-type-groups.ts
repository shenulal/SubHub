// src/components/notifications/notification-type-groups.ts
/**
 * Presentation metadata for notification type groups (icons, accents, i18n keys).
 */
import type { NotificationTypeGroup } from "@/types/notification";
import {
  BellRing,
  CalendarClock,
  CheckCircle2,
  ShieldAlert,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export interface TypeGroupMeta {
  group: NotificationTypeGroup;
  icon: LucideIcon;
  /** i18n key under `notifications.groups.*` */
  labelKey: string;
  /** Left accent + icon tint (light/dark aware). */
  accentClass: string;
  iconClass: string;
}

export const TYPE_GROUP_META: Record<NotificationTypeGroup, TypeGroupMeta> = {
  renewals: {
    group: "renewals",
    icon: CalendarClock,
    labelKey: "renewals",
    accentClass: "border-l-teal-500 dark:border-l-teal-400",
    iconClass: "bg-teal-500/10 text-teal-700 dark:text-teal-300",
  },
  approvals: {
    group: "approvals",
    icon: CheckCircle2,
    labelKey: "approvals",
    accentClass: "border-l-indigo-500 dark:border-l-indigo-400",
    iconClass: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  },
  priceChanges: {
    group: "priceChanges",
    icon: TrendingUp,
    labelKey: "priceChanges",
    accentClass: "border-l-amber-500 dark:border-l-amber-400",
    iconClass: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  security: {
    group: "security",
    icon: ShieldAlert,
    labelKey: "security",
    accentClass: "border-l-rose-500 dark:border-l-rose-400",
    iconClass: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
  other: {
    group: "other",
    icon: BellRing,
    labelKey: "other",
    accentClass: "border-l-slate-400 dark:border-l-slate-500",
    iconClass: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
  },
};

/** Filter chips shown in the centre (in display order). */
export const FILTER_GROUPS: NotificationTypeGroup[] = [
  "renewals",
  "approvals",
  "priceChanges",
  "security",
];
