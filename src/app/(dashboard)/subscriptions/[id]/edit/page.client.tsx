// src/app/(dashboard)/subscriptions/[id]/edit/page.client.tsx
"use client";

import type { SubscriptionFormOptions } from "@/actions/subscriptions/subscription-form-options";
import { SubscriptionForm } from "@/components/subscriptions/subscription-form";
import type {
  AppWithTeams,
  UserOption,
} from "@/components/subscriptions/subscription-form-assignment";
import type { SubscriptionDetail } from "@/types/subscription";

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
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-foreground min-w-0 text-2xl font-medium">
          {title}
        </h1>
      </div>

      <SubscriptionForm
        apps={apps}
        users={users}
        isAdmin={isAdmin}
        subscription={subscription}
        formId="subscription-edit-form"
        options={options}
      />
    </div>
  );
}
