// src/app/(dashboard)/settings/privacy/page.tsx
import {
  getPrivacyContext,
  listMyDataExports,
} from "@/actions/platform/privacy";
import { DataExportSection } from "@/components/platform/privacy/data-export-section";
import { DeleteAccountSection } from "@/components/settings/delete-account-section";
import { requireOrganization } from "@/lib/auth/require-auth";
import { can } from "@/lib/rbac/service";
import { SETTING_DEFINITIONS } from "@/lib/settings/registry";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = { title: "Privacy & data" };

export default async function PrivacySettingsPage() {
  await requireOrganization();
  const t = await getTranslations("platform.privacy");
  const [context, exports, canExport, canDelete] = await Promise.all([
    getPrivacyContext(),
    listMyDataExports(),
    can("data:export_own"),
    can("data:delete_own"),
  ]);
  const allowSelfDeletion =
    context.data?.allowSelfDeletion ??
    SETTING_DEFINITIONS["privacy.allowSelfDeletion"].defaultValue;
  const expiryHours =
    context.data?.exportExpiryHours ??
    SETTING_DEFINITIONS["privacy.dataExportExpiryHours"].defaultValue;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold tracking-tight">{t("title")}</h3>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </div>
      {canExport && (
        <DataExportSection
          exports={exports.data ?? []}
          expiryHours={expiryHours}
        />
      )}
      {canDelete && allowSelfDeletion ? (
        <DeleteAccountSection />
      ) : (
        <p className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
          {t("deletionDisabled")}
        </p>
      )}
    </div>
  );
}
