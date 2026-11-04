"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { PermissionGroupRow } from "@/types/platform";
import { useTranslations } from "next-intl";

interface PermissionMatrixProps {
  groups: PermissionGroupRow[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  readOnly?: boolean;
}

export function PermissionMatrix({
  groups,
  selected,
  onChange,
  readOnly = false,
}: PermissionMatrixProps) {
  const t = useTranslations("platform.roles");

  const toggleKey = (key: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(key);
    else next.delete(key);
    onChange(next);
  };

  const toggleGroup = (group: PermissionGroupRow, checked: boolean) => {
    const next = new Set(selected);
    for (const p of group.permissions) {
      if (checked) next.add(p.key);
      else next.delete(p.key);
    }
    onChange(next);
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {groups.map((group) => {
        const total = group.permissions.length;
        const count = group.permissions.filter((p) =>
          selected.has(p.key)
        ).length;
        const all = count === total;
        const some = count > 0 && !all;
        return (
          <fieldset
            key={group.group}
            className={cn(
              "rounded-lg border p-3",
              all && "border-primary/40 bg-primary/[0.03]"
            )}
          >
            <legend className="sr-only">{group.group}</legend>
            <label className="mb-2 flex cursor-pointer items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Checkbox
                  checked={all ? true : some ? "indeterminate" : false}
                  disabled={readOnly}
                  onCheckedChange={(v) => toggleGroup(group, v === true)}
                  aria-label={t("selectAll", { group: group.group })}
                />
                {group.group}
              </span>
              <span className="text-muted-foreground text-[11px] tabular-nums">
                {count}/{total}
              </span>
            </label>
            <ul className="space-y-1.5 pl-6">
              {group.permissions.map((p) => (
                <li key={p.key}>
                  <label className="flex cursor-pointer items-start gap-2 text-sm">
                    <Checkbox
                      checked={selected.has(p.key)}
                      disabled={readOnly}
                      onCheckedChange={(v) => toggleKey(p.key, v === true)}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block leading-tight">
                        {p.description}
                      </span>
                      <code className="text-muted-foreground text-[10px]">
                        {p.key}
                      </code>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        );
      })}
    </div>
  );
}
