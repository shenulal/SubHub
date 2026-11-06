// src/app/(dashboard)/apps/new/page.tsx
import { auth } from "@/lib/auth";
import { requirePermissionOrRedirect } from "@/lib/rbac/service";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { AppNewPageClient } from "./page.client";

/** Longest prefilled name accepted from `?name=` (matches the form's limit). */
const MAX_PREFILL_NAME = 100;

export default async function NewAppPage({
  searchParams,
}: {
  searchParams?: Promise<{ name?: string | string[] }>;
}) {
  const params = (await searchParams) ?? {};
  const rawName = Array.isArray(params.name) ? params.name[0] : params.name;
  const initialName = rawName?.trim().slice(0, MAX_PREFILL_NAME) || undefined;
  await requirePermissionOrRedirect("apps:manage", "/apps");
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const t = await getTranslations("apps.new");
  const userRole = session.user.role;
  const userTeamId = session.user.teamId ?? null;

  return (
    <AppNewPageClient
      userRole={userRole}
      userTeamId={userTeamId}
      title={t("pageTitle")}
      initialName={initialName}
    />
  );
}
