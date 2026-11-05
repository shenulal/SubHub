// src/app/(dashboard)/settings/notifications/page.tsx
import { getOrganizationNotificationDefaults } from "@/actions/notifications/org-defaults";
import { getNotificationPreferences } from "@/actions/notifications/preferences";
import { NotificationPreferencesForm } from "@/components/notifications/notification-preferences-form";
import { OrganizationNotificationDefaultsForm } from "@/components/notifications/organization-notification-defaults";
import { Separator } from "@/components/ui/separator";
import { requirePermissionOrRedirect } from "@/lib/rbac/service";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Notifications",
  description: "Choose how and when SubHub notifies you",
};

export default async function NotificationsSettingsPage() {
  const { permissions } = await requirePermissionOrRedirect(
    "notifications:manage_own"
  );
  const t = await getTranslations("notifications.preferences");
  const canManageOrg = permissions.has("settings:manage");

  const [prefs, orgDefaults] = await Promise.all([
    getNotificationPreferences(),
    canManageOrg
      ? getOrganizationNotificationDefaults()
      : Promise.resolve(null),
  ]);

  return (
    <div className="min-w-0 space-y-6">
      {prefs.success && prefs.data ? (
        <NotificationPreferencesForm initial={prefs.data} />
      ) : (
        <p className="text-destructive text-sm">
          {prefs.error ?? t("toast.failed")}
        </p>
      )}

      {canManageOrg && orgDefaults?.success && orgDefaults.data && (
        <>
          <Separator />
          <OrganizationNotificationDefaultsForm initial={orgDefaults.data} />
        </>
      )}
    </div>
  );
}
