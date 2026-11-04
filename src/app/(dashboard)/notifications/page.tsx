// src/app/(dashboard)/notifications/page.tsx
import { NotificationCentre } from "@/components/notifications/notification-centre";
import { requirePermissionOrRedirect } from "@/lib/rbac/service";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Notifications",
  description:
    "Renewals, approvals, price changes and security alerts in one place",
};

export default async function NotificationsPage() {
  await requirePermissionOrRedirect("notifications:read");
  return <NotificationCentre />;
}
