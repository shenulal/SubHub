// src/app/(dashboard)/subscriptions/suggestions/page.tsx
// src/app/(dashboard)/subscriptions/suggestions/page.tsx
import { SuggestionTable } from "@/components/subscriptions/suggestion-table";
import { getCachedSession } from "@/lib/auth/require-auth";
import { redirect } from "next/navigation";

export default async function SubscriptionSuggestionsPage() {
  const session = await getCachedSession();
  const role = session?.user?.role;

  // ADMIN only
  if (role !== "ADMIN") {
    redirect("/subscriptions");
  }

  return <SuggestionTable />;
}
