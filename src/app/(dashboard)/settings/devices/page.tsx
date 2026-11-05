// src/app/(dashboard)/settings/devices/page.tsx
import { DevicesPageClient } from "@/components/devices";
import { requireOrganization } from "@/lib/auth/require-auth";

export const metadata = {
  title: "Device Management",
  description: "Manage FleetDM agent devices and app usage",
};

export default async function DevicesPage() {
  const { role } = await requireOrganization();

  return <DevicesPageClient role={role} />;
}
