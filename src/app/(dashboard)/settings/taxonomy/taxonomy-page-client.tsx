// src/app/(dashboard)/settings/taxonomy/taxonomy-page-client.tsx
"use client";

import { FolderTree, Tags } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";

import { CategoryTreeEditor } from "@/components/taxonomy/category-tree-editor";
import { TagManager } from "@/components/taxonomy/tag-manager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CategoryNode, TagDto } from "@/types/taxonomy";

export interface TaxonomyPageClientProps {
  initialTab: "categories" | "tags";
  tree: CategoryNode[];
  tags: TagDto[];
  canManageCategories: boolean;
  canManageTags: boolean;
  canCreateTags: boolean;
}

export function TaxonomyPageClient({
  initialTab,
  tree,
  tags,
  canManageCategories,
  canManageTags,
  canCreateTags,
}: TaxonomyPageClientProps) {
  const t = useTranslations("taxonomy.settings");
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </header>
      <Tabs
        value={initialTab}
        onValueChange={(v) => router.replace(`${pathname}?tab=${v}`)}
      >
        <TabsList>
          <TabsTrigger value="categories">
            <FolderTree className="size-4" />
            {t("tabs.categories")}
          </TabsTrigger>
          <TabsTrigger value="tags">
            <Tags className="size-4" />
            {t("tabs.tags")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="categories" className="pt-4">
          <CategoryTreeEditor tree={tree} canManage={canManageCategories} />
        </TabsContent>
        <TabsContent value="tags" className="pt-4">
          <TagManager
            tags={tags}
            canManage={canManageTags}
            canCreate={canCreateTags}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
