// src/components/super-admin/format.ts
/** Date / number formatting for the Control Panel (platform time zone from settings). */

export function formatPanelDate(
  value: Date | string | null | undefined,
  timeZone: string,
  withTime = false
): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
    timeZone,
  }).format(date);
}

export const formatCount = (n: number) => n.toLocaleString("en-US");

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Platform admin",
  ADMIN: "Admin",
  APPROVER: "Approver",
  MEMBER: "Member",
  VIEWER: "Viewer",
};
