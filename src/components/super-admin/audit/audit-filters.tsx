"use client";

/** Platform audit filters (action, record type, actor, tenant, date range) in the URL. */
import type { PlatformAuditFacets } from "@/actions/super-admin/audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { describeAuditAction } from "@/lib/audit/describe-action";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const ALL = "__all";

function FacetSelect({
  label,
  param,
  options,
}: {
  label: string;
  param: string;
  options: { value: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const value = params.get(param) ?? ALL;
  const change = (v: string) => {
    const next = new URLSearchParams(params.toString());
    if (v === ALL) next.delete(param);
    else next.set(param, v);
    next.delete("page");
    router.replace(next.size ? `${pathname}?${next}` : pathname);
  };
  return (
    <Select value={value} onValueChange={change}>
      <SelectTrigger className="w-full min-w-0" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent
        searchPlaceholder={`Search ${label.toLowerCase()}`}
        emptyText="No matches"
      >
        <SelectItem value={ALL}>{`All ${label.toLowerCase()}`}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function DateInput({ param, label }: { param: string; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <Input
      type="date"
      aria-label={label}
      value={params.get(param) ?? ""}
      onChange={(e) => {
        const next = new URLSearchParams(params.toString());
        if (e.target.value) next.set(param, e.target.value);
        else next.delete(param);
        next.delete("page");
        router.replace(next.size ? `${pathname}?${next}` : pathname);
      }}
    />
  );
}

export function AuditFilters({ facets }: { facets: PlatformAuditFacets }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <div
      className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_160px_160px_auto]"
      data-testid="audit-filters"
    >
      <FacetSelect
        label="Actions"
        param="action"
        options={facets.actions.map((a) => ({
          value: a,
          label: describeAuditAction(a),
        }))}
      />
      <FacetSelect
        label="Record types"
        param="entityType"
        options={facets.entityTypes.map((e) => ({ value: e, label: e }))}
      />
      <FacetSelect
        label="Actors"
        param="actorId"
        options={facets.actors.map((a) => ({ value: a.id, label: a.label }))}
      />
      <FacetSelect
        label="Tenants"
        param="organizationId"
        options={facets.tenants.map((t) => ({ value: t.id, label: t.name }))}
      />
      <DateInput param="from" label="From date" />
      <DateInput param="to" label="To date" />
      <Button
        variant="outline"
        onClick={() => router.replace(pathname)}
        disabled={params.size === 0}
      >
        Clear
      </Button>
    </div>
  );
}
