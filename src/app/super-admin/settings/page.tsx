// src/app/super-admin/settings/page.tsx
import {
  getSystemSettings,
  resetSystemSetting,
  updateSystemSettings,
} from "@/actions/platform/system-settings";
import { WorkspaceSettingsForm } from "@/components/platform/settings/workspace-settings-form";
import { Card } from "@/components/ui/card";
import { requireSuperAdmin } from "@/lib/auth/require-auth";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Platform settings | Super Admin",
};

/** Adapter: the shared form passes (group, values); system scope ignores group. */
async function saveSystem(_group: string, values: Record<string, unknown>) {
  "use server";
  return updateSystemSettings(values);
}

export default async function SuperAdminSettingsPage() {
  await requireSuperAdmin();
  const result = await getSystemSettings();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Platform settings</h1>
        <p className="text-muted-foreground">
          Defaults that apply to every workspace unless an organisation
          overrides them.
        </p>
      </div>
      <Card className="rounded-sm p-6">
        {result.success && result.data ? (
          <WorkspaceSettingsForm
            payload={result.data}
            canManage
            saveAction={saveSystem}
            resetAction={resetSystemSetting}
          />
        ) : (
          <p className="text-destructive text-sm">{result.error}</p>
        )}
      </Card>
    </div>
  );
}
