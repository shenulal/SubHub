// src/app/(dashboard)/settings/notification-templates/page.tsx
import { listNotificationTemplates } from "@/actions/platform/notification-templates";
import { TemplatesClient } from "@/components/platform/notification-templates/templates-client";
import { requirePermissionOrRedirect } from "@/lib/rbac/service";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Notification templates" };

export default async function NotificationTemplatesPage() {
  await requirePermissionOrRedirect(
    "notifications:manage_templates",
    "/settings"
  );
  const result = await listNotificationTemplates();
  if (!result.success || !result.data) {
    return <p className="text-destructive text-sm">{result.error}</p>;
  }
  return <TemplatesClient rows={result.data} />;
}
