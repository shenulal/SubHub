// src/app/(dashboard)/(org)/users/offboarded/page.tsx
import { TerminatedUsersPageClient } from "@/components/users/terminated-users-page-client";
import { requirePermissionOrRedirect } from "@/lib/rbac/service";
import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("users.terminated.page");
  return {
    title: `${t("title")}`,
    description: t("description"),
  };
}

export default async function TerminatedUsersPage() {
  await requirePermissionOrRedirect("members:read", "/users");
  return <TerminatedUsersPageClient />;
}
