// src/app/(dashboard)/subscriptions/receipts/page.tsx
import { getMailboxes, getReceiptSuggestions } from "@/actions/receipts";
import { resolveReceiptScopeOrRedirect } from "@/actions/receipts/_shared";
import { getCategoryTree } from "@/actions/taxonomy/categories";
import type { CategoryOption } from "@/components/receipts/accept-suggestion-dialog";
import { ReceiptsReviewClient } from "@/components/receipts/receipts-review-client";
import { getSetting } from "@/lib/settings/service";
import type { CategoryNode } from "@/types/taxonomy";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Receipt suggestions" };

function flattenCategories(
  nodes: CategoryNode[],
  parentName: string | null = null
): CategoryOption[] {
  return nodes.flatMap((n) => [
    { id: n.id, name: n.name, parentName },
    ...flattenCategories(n.children ?? [], n.name),
  ]);
}

export default async function ReceiptSuggestionsPage() {
  const scope = await resolveReceiptScopeOrRedirect("/subscriptions");
  const [page, mailboxes, currencies, categories] = await Promise.all([
    getReceiptSuggestions({ status: "NEW" }),
    getMailboxes(),
    getSetting(scope.organizationId, "finance.enabledCurrencies"),
    getCategoryTree(),
  ]);

  return (
    <ReceiptsReviewClient
      initialPage={
        page.data ?? {
          items: [],
          total: 0,
          page: 1,
          limit: 50,
          counts: { NEW: 0, ACCEPTED: 0, DISMISSED: 0, DUPLICATE: 0 },
        }
      }
      mailboxes={mailboxes.data ?? []}
      currencies={currencies}
      categories={flattenCategories(categories)}
      canCreate={scope.permissions.has("subscriptions:create")}
    />
  );
}
