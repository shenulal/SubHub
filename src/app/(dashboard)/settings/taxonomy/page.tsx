// src/app/(dashboard)/settings/taxonomy/page.tsx
import { getCategoryTree } from "@/actions/taxonomy/categories";
import { listTags } from "@/actions/taxonomy/tags";
import { requireOrganization } from "@/lib/auth/require-auth";
import { can } from "@/lib/rbac/service";

import { TaxonomyPageClient } from "./taxonomy-page-client";

export const metadata = { title: "Taxonomy" };

export default async function TaxonomySettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireOrganization();
  const [
    { tab },
    tree,
    tags,
    canManageCategories,
    canManageTags,
    canCreateTags,
  ] = await Promise.all([
    searchParams,
    getCategoryTree({ includeArchived: true }),
    listTags(),
    can("categories:manage"),
    can("tags:manage"),
    can("tags:create"),
  ]);

  return (
    <TaxonomyPageClient
      initialTab={tab === "tags" ? "tags" : "categories"}
      tree={tree}
      tags={tags}
      canManageCategories={canManageCategories}
      canManageTags={canManageTags}
      canCreateTags={canCreateTags}
    />
  );
}
