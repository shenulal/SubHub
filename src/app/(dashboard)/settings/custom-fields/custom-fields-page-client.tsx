// src/app/(dashboard)/settings/custom-fields/custom-fields-page-client.tsx
"use client";

import { useTranslations } from "next-intl";

import { CustomFieldManager } from "@/components/taxonomy/custom-field-manager";
import type { CustomFieldDefinitionDto } from "@/types/taxonomy";

export interface CustomFieldsPageClientProps {
  fields: CustomFieldDefinitionDto[];
  maxFields: number;
  canManage: boolean;
}

export function CustomFieldsPageClient({
  fields,
  maxFields,
  canManage,
}: CustomFieldsPageClientProps) {
  const t = useTranslations("taxonomy.customFields");
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-foreground text-lg leading-snug font-medium">
          {t("title")}
        </h1>
      </header>
      <CustomFieldManager
        fields={fields}
        maxFields={maxFields}
        canManage={canManage}
      />
    </div>
  );
}
