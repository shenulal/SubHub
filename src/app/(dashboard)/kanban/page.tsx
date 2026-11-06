// src/app/(dashboard)/kanban/page.tsx
import { V2ComingSoon } from "@/components/common";
import { KanbanPageClient } from "@/components/kanban";
import { can, requirePermissionOrRedirect } from "@/lib/rbac/service";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("kanban");
  return {
    title: `${t("page.title")}`,
    description: t("page.description"),
  };
}

export default async function KanbanPage() {
  await requirePermissionOrRedirect("subscriptions:read", "/dashboard");
  // V2 features are toggled by an environment variable (default: disabled)
  if (process.env.ENABLE_V2_FEATURES !== "true") {
    return (
      <V2ComingSoon
        feature="Kanban board"
        description="Manage tasks with drag and drop."
      />
    );
  }

  // Existing logic when V2 is enabled
  const canManage = await can("subscriptions:update");

  return <KanbanPageClient canManage={canManage} />;
}
