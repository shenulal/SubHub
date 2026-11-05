// src/app/(dashboard)/settings/taxonomy/page.tsx
import { redirect } from "next/navigation";

export const metadata = { title: "Taxonomy" };

/** Categories and tags now live in the Master data hub. */
export default async function TaxonomySettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  redirect(`/settings/masters?tab=${tab === "tags" ? "tags" : "categories"}`);
}
