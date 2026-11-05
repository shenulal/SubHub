// src/components/common/quick-create/manage-master-link.tsx
"use client";

/**
 * "Manage …" footer link for master-data dropdowns. Place it as the last child
 * of a searchable `SelectContent`. The Select renders its children twice (once
 * hidden to collect item labels, once in the open list), so the link only shows
 * when it is mounted inside the open list; it is gated on the manage permission.
 */
import { usePermissionFlag } from "@/hooks/use-permission-flag";
import type { PermissionKey } from "@/lib/rbac/permissions";
import { Settings2 } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";

interface ManageMasterLinkProps {
  /** Target, e.g. `/settings/masters?tab=cost-centers`. */
  href: string;
  /** What is managed, lower-case plural (e.g. "cost centres"). */
  label: string;
  permission: PermissionKey;
}

const LIST_SELECTOR = '[data-slot="select-content"]';

export function ManageMasterLink({
  href,
  label,
  permission,
}: ManageMasterLinkProps) {
  const t = useTranslations("shell.inline");
  const allowed = usePermissionFlag(permission);
  const probe = useRef<HTMLSpanElement>(null);
  const [inList, setInList] = useState(false);

  useLayoutEffect(() => {
    if (probe.current) setInList(Boolean(probe.current.closest(LIST_SELECTOR)));
  }, [allowed]);

  if (!allowed) return null;
  if (!inList) return <span ref={probe} hidden />;
  return (
    <div className="border-border -mx-1 mt-1 border-t px-1 pt-1">
      <Link
        href={href}
        className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring flex items-center gap-2 rounded-sm px-3 py-2 text-[0.8125rem] outline-none focus-visible:ring-2"
      >
        <Settings2 className="size-4" />
        {t("manage", { name: label })}
      </Link>
    </div>
  );
}
