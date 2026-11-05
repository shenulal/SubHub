// src/app/(dashboard)/tasks/page.tsx
import { V2ComingSoon } from "@/components/common";
import { TasksPageClient } from "@/components/tasks";
import { requireOrganization } from "@/lib/auth/require-auth";
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
  const { role } = await requireOrganization();
  const canManage = role === "ADMIN" || role === "MEMBER";

  return <TasksPageClient canManage={canManage} />;
}
