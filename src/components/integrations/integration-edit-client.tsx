// src/components/integrations/integration-edit-client.tsx
"use client";

import { IntegrationStatusForm } from "@/components/integrations/integration-status-form";
import { Button } from "@/components/ui/button";
import { useShow } from "@refinedev/core";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useMemo } from "react";
import type { IntegrationStatusValues } from "./integration-form-schema";

interface IntegrationEditClientProps {
  id: string;
}

export function IntegrationEditClient({ id }: IntegrationEditClientProps) {
  const t = useTranslations();
  const {
    query: { data, isLoading },
  } = useShow({
    resource: "integrations",
    id,
    queryOptions: { enabled: Boolean(id) },
  });

  const status: IntegrationStatusValues["status"] = useMemo(() => {
    const record = data?.data as
      | { status?: IntegrationStatusValues["status"] }
      | undefined;
    return record?.status ?? "PENDING";
  }, [data?.data]);

  if (isLoading) {
    return (
      <div className="text-muted-foreground text-sm">
        {t("integrations.actions.editInfo")}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex min-w-0 items-center gap-4">
        <Link href={`/integrations/${id}`} className="shrink-0">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="min-w-0">
          <h1 className="text-foreground truncate text-2xl font-medium">
            {t("integrations.actions.editStatus")}
          </h1>
          <p className="text-muted-foreground text-[0.9375rem]">
            {t("integrations.actions.editStatusDescription")}
          </p>
        </div>
      </div>

      <IntegrationStatusForm id={id} defaultStatus={status} />
    </div>
  );
}
