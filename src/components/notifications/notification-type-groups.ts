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
    accentClass: "border-l-success",
    iconClass: "tonal-success",
  },
  approvals: {
    group: "approvals",
    icon: CheckCircle2,
    labelKey: "approvals",
    accentClass: "border-l-primary",
    iconClass: "tonal-primary",
  },
  priceChanges: {
    group: "priceChanges",
    icon: TrendingUp,
    labelKey: "priceChanges",
    accentClass: "border-l-warning",
    iconClass: "tonal-warning",
  },
  security: {
    group: "security",
    icon: ShieldAlert,
    labelKey: "security",
    accentClass: "border-l-error",
    iconClass: "tonal-error",
  },
  other: {
    group: "other",
    icon: BellRing,
    labelKey: "other",
    accentClass: "border-l-muted-foreground",
    iconClass: "tonal-neutral",
  },
};

/** Filter chips shown in the centre (in display order). */
export const FILTER_GROUPS: NotificationTypeGroup[] = [
  "renewals",
  "approvals",
  "priceChanges",
  "security",
];
