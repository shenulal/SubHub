// src/app/(dashboard)/settings/taxonomy/taxonomy-page-client.tsx
"use client";

import { FolderTree, Tags } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";

import { CategoryTreeEditor } from "@/components/taxonomy/category-tree-editor";
import { TagManager } from "@/components/taxonomy/tag-manager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CategoryNode, TagDto } from "@/types/taxonomy";

/** Materio pill tab (account-settings style). */
const PILL_TAB =
  "text-foreground hover:bg-primary/10 hover:text-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:hover:text-primary-foreground h-[38px] gap-2 rounded-md px-4 after:hidden data-[state=active]:shadow-xs";

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
        <h1 className="text-foreground text-lg leading-snug font-medium">
          {t("title")}
        </h1>
        <p className="text-muted-foreground text-[0.8125rem]">
          {t("subtitle")}
        </p>
      </header>
      <Tabs
        value={initialTab}
        onValueChange={(v) => router.replace(`${pathname}?tab=${v}`)}
      >
        <TabsList className="h-auto flex-wrap gap-2 overflow-visible border-b-0">
          <TabsTrigger value="categories" className={PILL_TAB}>
            <FolderTree className="size-4" />
            {t("tabs.categories")}
          </TabsTrigger>
          <TabsTrigger value="tags" className={PILL_TAB}>
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
