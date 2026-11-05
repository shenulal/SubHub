import { ExtensionsSidebar } from "@/components/extensions/extensions-sidebar";
import { Card } from "@/components/ui/card";
import { getTranslations } from "next-intl/server";

interface ExtensionsLayoutProps {
  children: React.ReactNode;
}

export default async function ExtensionsLayout({
  children,
}: ExtensionsLayoutProps) {
  const t = await getTranslations("sidebar.menu.extensions");

  return (
    <div className="space-y-5">
      <div className="space-y-0.5">
        <h2 className="text-foreground text-2xl leading-tight font-medium">
          {t("root")}
        </h2>
      </div>

      {/* 사이드바와 콘텐츠 영역 */}
      <div className="flex min-w-0 flex-col gap-6 xl:flex-row xl:items-start">
        {/* 좌측 사이드바 메뉴 - Card */}
        <aside className="min-w-0 xl:sticky xl:top-20 xl:w-[260px] xl:shrink-0">
          <Card className="gap-0 p-2">
            <ExtensionsSidebar />
          </Card>
        </aside>

        {/* 우측 콘텐츠 영역 - Card */}
        <main className="min-w-0 flex-1">
          <Card className="min-w-0 gap-0 p-5 sm:p-6">{children}</Card>
        </main>
      </div>
    </div>
  );
}
