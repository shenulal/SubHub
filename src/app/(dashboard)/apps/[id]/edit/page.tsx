// src/app/(dashboard)/apps/[id]/edit/page.tsx
import { getApp } from "@/actions/apps";
import { AppEditForm } from "@/components/apps/app-edit-form";
import { PageHeader } from "@/components/common/page-header";
import { auth } from "@/lib/auth";
import { requirePermissionOrRedirect } from "@/lib/rbac/service";
import { notFound, redirect } from "next/navigation";

interface AppEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function AppEditPage({ params }: AppEditPageProps) {
  await requirePermissionOrRedirect("apps:manage", "/apps");
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;
  const app = await getApp(id);

  if (!app) {
    notFound();
  }

  const userRole = session.user.role;
  const userTeamId = session.user.teamId ?? null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={`Edit ${app.name}`}
        description="Edit the app details"
        showBack
        backHref={`/apps/${id}`}
      />

      <AppEditForm app={app} userRole={userRole} userTeamId={userTeamId} />
    </div>
  );
}
