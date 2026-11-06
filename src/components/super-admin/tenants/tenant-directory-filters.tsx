"use client";

/** Search + status filter for the tenant list (state lives in the URL). */
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const STATUSES = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
];

export function TenantDirectoryFilters({ debounceMs }: { debounceMs: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const status = params.get("status") ?? "all";

  const push = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v && v !== "all") next.set(k, v);
      else next.delete(k);
    }
    router.replace(next.size ? `${pathname}?${next}` : pathname);
  };

  useEffect(() => {
    if ((params.get("q") ?? "") === search.trim()) return;
    const timer = setTimeout(() => push({ q: search.trim() }), debounceMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div
      className="flex min-w-0 flex-wrap items-center gap-3"
      data-testid="tenant-filters"
    >
      <div className="relative min-w-0 flex-1 sm:max-w-[360px]">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or domain"
          className="pl-9"
          aria-label="Search tenants"
        />
      </div>
      <Select value={status} onValueChange={(v) => push({ status: v })}>
        <SelectTrigger className="w-full sm:w-[200px]" aria-label="Status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
