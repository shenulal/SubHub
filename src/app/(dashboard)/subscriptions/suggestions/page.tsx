// src/app/(dashboard)/subscriptions/suggestions/page.tsx
import { SuggestionTable } from "@/components/subscriptions/suggestion-table";
import { requirePermissionOrRedirect } from "@/lib/rbac/service";

export default async function SubscriptionSuggestionsPage() {
  // Accepting a suggestion creates a subscription and assigns its users.
  await requirePermissionOrRedirect(
    ["subscriptions:create", "subscriptions:assign"],
    "/subscriptions"
  );

  return <SuggestionTable />;
}
