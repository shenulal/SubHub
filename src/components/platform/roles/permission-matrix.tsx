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
    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
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
              "min-w-0 rounded-md border p-4 transition-colors",
              all && "border-primary/50 bg-primary/[0.04]"
            )}
          >
            <legend className="sr-only">{group.group}</legend>
            <label className="mb-3 flex min-w-0 cursor-pointer items-center justify-between gap-2 border-b pb-3">
              <span className="text-foreground flex min-w-0 items-center gap-2 text-[0.9375rem] font-medium">
                <Checkbox
                  checked={all ? true : some ? "indeterminate" : false}
                  disabled={readOnly}
                  onCheckedChange={(v) => toggleGroup(group, v === true)}
                  aria-label={t("selectAll", { group: group.group })}
                />
                <span className="truncate">{group.group}</span>
              </span>
              <span
                className={cn(
                  "shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
                  count > 0 ? "tonal-primary" : "tonal-neutral"
                )}
              >
                {count}/{total}
              </span>
            </label>
            <ul className="space-y-2.5">
              {group.permissions.map((p) => (
                <li key={p.key} className="min-w-0">
                  <label className="flex min-w-0 cursor-pointer items-start gap-2.5 text-[0.9375rem]">
                    <Checkbox
                      checked={selected.has(p.key)}
                      disabled={readOnly}
                      onCheckedChange={(v) => toggleKey(p.key, v === true)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="text-foreground block leading-snug break-words">
                        {p.description}
                      </span>
                      <code
                        className="text-muted-foreground block truncate text-[11px]"
                        title={p.key}
                      >
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
