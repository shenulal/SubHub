// src/app/(dashboard)/settings/custom-fields/page.tsx
import { getCustomFieldDefinitions } from "@/actions/taxonomy/custom-fields";
import { requireOrganization } from "@/lib/auth/require-auth";
import { can } from "@/lib/rbac/service";
import { getSetting } from "@/lib/settings/service";

import { CustomFieldsPageClient } from "./custom-fields-page-client";

export const metadata = { title: "Custom fields" };

export default async function CustomFieldsSettingsPage() {
  const { organizationId } = await requireOrganization();
  const [fields, maxFields, canManage] = await Promise.all([
    getCustomFieldDefinitions({ includeArchived: true }),
    getSetting(organizationId, "subscriptions.maxCustomFields"),
    can("custom_fields:manage"),
  ]);
  return (
    <CustomFieldsPageClient
      fields={fields}
      maxFields={maxFields}
      canManage={canManage}
    />
  );
}
