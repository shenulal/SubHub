import { DevicesPageClient } from "@/components/devices";
import { requirePermissionOrRedirect } from "@/lib/rbac/service";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("devices.page");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function DevicesPage() {
  const { permissions } = await requirePermissionOrRedirect(
    "extensions:read",
    "/dashboard"
  );

  return <DevicesPageClient canManage={permissions.has("extensions:manage")} />;
}
