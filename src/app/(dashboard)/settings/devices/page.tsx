// src/app/(dashboard)/settings/devices/page.tsx
import { DevicesPageClient } from "@/components/devices";
import { requirePermissionOrRedirect } from "@/lib/rbac/service";

export const metadata = {
  title: "Device Management",
  description: "Manage FleetDM agent devices and app usage",
};

export default async function DevicesPage() {
  const { permissions } = await requirePermissionOrRedirect(
    "extensions:read",
    "/settings"
  );

  return <DevicesPageClient canManage={permissions.has("extensions:manage")} />;
}
