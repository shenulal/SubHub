// src/app/(dashboard)/subscriptions/new/page.client.tsx
"use client";

import type { SubscriptionFormOptions } from "@/actions/subscriptions/subscription-form-options";
import { SubscriptionForm } from "@/components/subscriptions/subscription-form";
import type {
  AppWithTeams,
  UserOption,
} from "@/components/subscriptions/subscription-form-assignment";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface SubscriptionNewPageClientProps {
  apps: AppWithTeams[];
  users: UserOption[];
  isAdmin: boolean;
  title: string;
  options?: SubscriptionFormOptions;
}

export function SubscriptionNewPageClient({
  apps,
  users,
  isAdmin,
  title,
  options,
}: SubscriptionNewPageClientProps) {
  const t = useTranslations("subscriptions");
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
          <Button
            type="submit"
            form="subscription-new-form"
            disabled={isPending}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("actions.register")}
          </Button>
        </div>
      </div>

      <SubscriptionForm
        apps={apps}
        users={users}
        isAdmin={isAdmin}
        hideActions={true}
        formId="subscription-new-form"
        onPendingChange={setIsPending}
        options={options}
      />
    </div>
  );
}
