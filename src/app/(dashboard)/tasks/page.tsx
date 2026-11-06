// src/app/(dashboard)/tasks/page.tsx
import { V2ComingSoon } from "@/components/common";
import { TasksPageClient } from "@/components/tasks";
import { can, requirePermissionOrRedirect } from "@/lib/rbac/service";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("tasks");
  return {
    title: `${t("page.title")}`,
    description: t("page.description"),
  };
}

export default async function TasksPage() {
  await requirePermissionOrRedirect("subscriptions:read", "/dashboard");
  // V2 features are toggled by an environment variable (default: disabled)
  if (process.env.ENABLE_V2_FEATURES !== "true") {
    return (
      <V2ComingSoon
        feature="Task management"
        description="Track and manage SaaS management tasks."
      />
    );
  }

  // Existing logic when V2 is enabled
  const canManage = await can("subscriptions:update");

  return <TasksPageClient canManage={canManage} />;
}
