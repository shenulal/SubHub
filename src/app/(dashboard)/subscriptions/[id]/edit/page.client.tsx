// src/app/(dashboard)/subscriptions/[id]/edit/page.client.tsx
"use client";

import type { SubscriptionFormOptions } from "@/actions/subscriptions/subscription-form-options";
import { SubscriptionForm } from "@/components/subscriptions/subscription-form";
import type {
  AppWithTeams,
  UserOption,
} from "@/components/subscriptions/subscription-form-assignment";
import { Button } from "@/components/ui/button";
import type { SubscriptionDetail } from "@/types/subscription";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface SubscriptionEditPageClientProps {
  apps: AppWithTeams[];
  users: UserOption[];
  isAdmin: boolean;
  subscription: SubscriptionDetail;
  title: string;
  options?: SubscriptionFormOptions;
}

export function SubscriptionEditPageClient({
  apps,
  users,
  isAdmin,
  subscription,
  title,
  options,
}: SubscriptionEditPageClientProps) {
  const t = useTranslations("subscriptions");
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  return (
    <div className="space-y-6">
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
            form="subscription-edit-form"
            disabled={isPending}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("actions.save")}
          </Button>
        </div>
      </div>

      <SubscriptionForm
        apps={apps}
        users={users}
        isAdmin={isAdmin}
        subscription={subscription}
        hideActions={true}
        formId="subscription-edit-form"
        onPendingChange={setIsPending}
        options={options}
      />
    </div>
  );
}
