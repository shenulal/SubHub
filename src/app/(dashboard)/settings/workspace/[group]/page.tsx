// src/app/(dashboard)/settings/workspace/[group]/page.tsx
import {
  getWorkspaceSettings,
  listWorkspaceSettingGroups,
  resetWorkspaceSetting,
  updateWorkspaceSettings,
} from "@/actions/platform/settings";
import { SettingsGroupTabs } from "@/components/platform/settings/settings-group-tabs";
import { WorkspaceSettingsForm } from "@/components/platform/settings/workspace-settings-form";
import { can, requirePermissionOrRedirect } from "@/lib/rbac/service";
import { SETTING_GROUPS } from "@/lib/settings/registry";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ group: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { group } = await params;
  const meta = SETTING_GROUPS[group as keyof typeof SETTING_GROUPS];
  return { title: meta ? `${meta.label} settings` : "Workspace settings" };
}

export default async function WorkspaceSettingsGroupPage({
  params,
}: PageProps) {
  const { group } = await params;
  if (!(group in SETTING_GROUPS) || group === "system") notFound();
  await requirePermissionOrRedirect("settings:read", "/settings");
  const [result, groups, canManage] = await Promise.all([
    getWorkspaceSettings(group),
    listWorkspaceSettingGroups(),
    can("settings:manage"),
  ]);
  if (!result.success || !result.data) {
    return (
      <div className="tonal-error rounded-md p-4 text-[0.9375rem]">
        {result.error}
      </div>
    );
  }
  return (
    <div>
      <SettingsGroupTabs groups={groups} />
      <WorkspaceSettingsForm
        key={group}
        payload={result.data}
        canManage={canManage}
        saveAction={updateWorkspaceSettings}
        resetAction={resetWorkspaceSetting}
      />
    </div>
  );
}
