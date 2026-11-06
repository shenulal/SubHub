// src/app/(dashboard)/apps/new/page.client.tsx
"use client";

import { AppForm } from "@/components/apps/app-form";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface AppNewPageClientProps {
  userRole: string | undefined;
  userTeamId: string | null;
  title: string;
  /** Prefill from `?name=` (e.g. the quick-create dialog's "full form" link). */
  initialName?: string;
}

export function AppNewPageClient({
  userRole,
  userTeamId,
  title,
  initialName,
}: AppNewPageClientProps) {
  const t = useTranslations("apps");
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  return (
    <div className="space-y-6">
      {/* Button aligned with the title */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-foreground min-w-0 text-2xl font-medium">
          {title}
        </h1>
        <div className="flex shrink-0 flex-wrap items-center gap-2 [&>button]:whitespace-nowrap">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isPending}
          >
            {t("actions.cancel")}
          </Button>
          <Button type="submit" form="app-new-form" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("form.create.actions.register")}
          </Button>
        </div>
      </div>

      <AppForm
        userRole={userRole}
        userTeamId={userTeamId}
        hideActions={true}
        formId="app-new-form"
        onPendingChange={setIsPending}
        initialName={initialName}
      />
    </div>
  );
}
