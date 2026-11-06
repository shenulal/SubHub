// src/app/(dashboard)/settings/import/page.tsx
import { PageHeader } from "@/components/common/page-header";
import { CsvUploadForm } from "@/components/import/csv-upload-form";
import { requirePermissionOrRedirect } from "@/lib/rbac/service";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("import.page");
  return {
    title: `${t("title")}`,
    description: t("description"),
  };
}

export default async function ImportPage() {
  await requirePermissionOrRedirect(
    ["apps:manage", "subscriptions:bulk", "members:manage"],
    "/settings",
    {
      mode: "any",
    }
  );
  const t = await getTranslations("import.page");

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("title")}
        description={t("description")}
        showBack
        backHref="/settings"
      />

      <CsvUploadForm />
    </div>
  );
}
