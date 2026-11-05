// src/app/(dashboard)/subscriptions/new/page.client.tsx
"use client";

import type { SubscriptionFormOptions } from "@/actions/subscriptions/subscription-form-options";
import { SubscriptionForm } from "@/components/subscriptions/subscription-form";
import type {
  AppWithTeams,
  UserOption,
} from "@/components/subscriptions/subscription-form-assignment";

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
  return (
    <div className="space-y-6">
      {/* Actions live in the sticky footer of the form */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-foreground min-w-0 text-2xl font-medium">
          {title}
        </h1>
      </div>

      <SubscriptionForm
        apps={apps}
        users={users}
        isAdmin={isAdmin}
        formId="subscription-new-form"
        options={options}
      />
    </div>
  );
}
