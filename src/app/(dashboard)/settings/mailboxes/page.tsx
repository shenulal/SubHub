// src/app/(dashboard)/settings/mailboxes/page.tsx
import { getMailboxes } from "@/actions/receipts";
import { resolveReceiptScopeOrRedirect } from "@/actions/receipts/_shared";
import { MailboxesSettingsClient } from "@/components/receipts/mailboxes-settings-client";
import { getProviderAvailability } from "@/lib/services/receipts/providers";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Mailboxes" };

export default async function MailboxesSettingsPage() {
  const scope = await resolveReceiptScopeOrRedirect("/settings");
  const mailboxes = await getMailboxes();

  return (
    <Suspense>
      <MailboxesSettingsClient
        initialMailboxes={mailboxes.data ?? []}
        availability={getProviderAvailability()}
        canManageAll={scope.permissions.has("mailboxes:manage")}
      />
    </Suspense>
  );
}
