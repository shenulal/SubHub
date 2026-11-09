"use client";

import { CreditCard, LucideIcon, Receipt } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { SECTION_NAV_LINK_PROPS } from "@/components/layouts/section-layout";
import { cn } from "@/lib/utils";

interface PaymentsMenuItem {
  icon: LucideIcon;
  label: string;
  href: string;
  description?: string;
}

const paymentsMenuConfig = [
  {
    icon: Receipt,
    labelKey: "sidebar.menu.payments.records",
    descriptionKey: "sidebar.menu.payments.recordsDescription",
    href: "/payments",
    exact: true,
  },
  {
    icon: CreditCard,
    labelKey: "sidebar.menu.payments.cards",
    descriptionKey: "sidebar.menu.payments.cardsDescription",
    href: "/payments/cards",
  },
];

export function PaymentsSidebar() {
  const pathname = usePathname();
  const t = useTranslations();

  const menuItems: (PaymentsMenuItem & { exact?: boolean })[] = useMemo(
    () =>
      paymentsMenuConfig.map((item) => ({
        icon: item.icon,
        label: t(item.labelKey),
        href: item.href,
        description: item.descriptionKey ? t(item.descriptionKey) : undefined,
        exact: item.exact,
      })),
    [t]
  );

  return (
    <nav className="flex min-w-0 gap-1 overflow-x-auto pb-1 xl:flex-col xl:overflow-visible xl:pb-0">
      {menuItems.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            {...SECTION_NAV_LINK_PROPS}
            className={cn(
              "group flex shrink-0 items-start gap-3 rounded-md px-3 py-2.5 text-[0.9375rem] leading-snug font-medium transition-colors xl:min-w-0 xl:shrink",
              isActive
                ? "bg-accent bg-primary/16! text-primary"
                : "text-foreground hover:bg-accent"
            )}
          >
            <Icon className="mt-px size-[18px] shrink-0" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span>{item.label}</span>
              {item.description && (
                <span className="text-muted-foreground group-aria-[current=page]:text-primary/75 hidden truncate text-[0.8125rem] font-normal xl:block">
                  {item.description}
                </span>
              )}
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
