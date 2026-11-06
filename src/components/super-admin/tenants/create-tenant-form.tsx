"use client";

/**
 * Create a tenant (organisation + defaults from masters) together with its first
 * Tenant Admin. Used by Tenants → New (SaaS) and the single-tenant first-run setup.
 */
import {
  createTenantWithAdmin,
  type CreatedTenant,
} from "@/actions/super-admin/tenant-lifecycle";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  AdminCredentialsFields,
  EMPTY_ADMIN,
  type AdminFieldsValue,
} from "../admin-credentials-fields";
import { ProvisionedAdminNotice } from "../credential-reveal";

export interface Option {
  value: string;
  label: string;
}

export interface CreateTenantFormProps {
  countries: (Option & { currency: string | null })[];
  currencies: Option[];
  timezones: string[];
  defaults: { countryCode: string; baseCurrency: string; timezone: string };
  /** Where "Open tenant" goes after creation; `{id}` is replaced by the tenant id. */
  detailHref: string;
}

function SearchSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent
        searchPlaceholder={`Search ${placeholder.toLowerCase()}`}
        emptyText="No matches"
      >
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CreatedPanel({
  created,
  href,
}: {
  created: CreatedTenant;
  href: string;
}) {
  return (
    <Card data-testid="tenant-created">
      <CardContent className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="tonal-success flex size-10 shrink-0 items-center justify-center rounded-md">
            <CheckCircle2 className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-foreground truncate text-lg font-medium">
              {created.name} is ready
            </p>
            <p className="text-muted-foreground text-[0.875rem]">
              Default roles, categories, payment methods, billing cycles and tax
              rate were created.
            </p>
          </div>
        </div>
        <ProvisionedAdminNotice admin={created.admin} />
        <div>
          <Button asChild>
            <Link href={href}>Open tenant</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function CreateTenantForm({
  countries,
  currencies,
  timezones,
  defaults,
  detailHref,
}: CreateTenantFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [countryCode, setCountryCode] = useState(defaults.countryCode);
  const [baseCurrency, setBaseCurrency] = useState(defaults.baseCurrency);
  const [timezone, setTimezone] = useState(defaults.timezone);
  const [admin, setAdmin] = useState<AdminFieldsValue>(EMPTY_ADMIN);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedTenant | null>(null);

  const onCountry = (code: string) => {
    setCountryCode(code);
    const suggested = countries.find((c) => c.value === code)?.currency;
    if (suggested && currencies.some((c) => c.value === suggested))
      setBaseCurrency(suggested);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createTenantWithAdmin({
        name,
        domain,
        countryCode,
        baseCurrency,
        timezone,
        admin,
      });
      if (result.success && result.data) {
        setCreated(result.data);
        router.refresh();
      } else {
        setError(
          result.error ?? result.message ?? "The tenant could not be created."
        );
      }
    });
  };

  if (created)
    return (
      <CreatedPanel
        created={created}
        href={detailHref.replace("{id}", created.id)}
      />
    );

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-6"
      data-testid="create-tenant-form"
    >
      <Card>
        <CardHeader>
          <CardTitle>Organisation</CardTitle>
          <CardDescription>
            Country, currency and time zone come from the platform masters and
            become the tenant&apos;s defaults.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="tenant-name">Organisation name</Label>
            <Input
              id="tenant-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Gulf Logistics LLC"
              required
            />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="tenant-domain">Primary domain (optional)</Label>
            <Input
              id="tenant-domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="e.g. gulflogistics.ae"
            />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="tenant-country">Country</Label>
            <SearchSelect
              id="tenant-country"
              value={countryCode}
              onChange={onCountry}
              options={countries}
              placeholder="Country"
            />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="tenant-currency">Base currency</Label>
            <SearchSelect
              id="tenant-currency"
              value={baseCurrency}
              onChange={setBaseCurrency}
              options={currencies}
              placeholder="Currency"
            />
          </div>
          <div className="min-w-0 space-y-1.5 sm:col-span-2">
            <Label htmlFor="tenant-timezone">Time zone</Label>
            <SearchSelect
              id="tenant-timezone"
              value={timezone}
              onChange={setTimezone}
              options={timezones.map((z) => ({
                value: z,
                label: z.replaceAll("_", " "),
              }))}
              placeholder="Time zone"
            />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>First Tenant Admin</CardTitle>
          <CardDescription>
            The tenant&apos;s own administrator. They manage users, roles and
            settings inside the tenant workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminCredentialsFields
            value={admin}
            onChange={setAdmin}
            idPrefix="first-admin"
          />
        </CardContent>
      </Card>
      {error && (
        <p role="alert" className="tonal-error rounded-md p-3 text-[0.875rem]">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating tenant…" : "Create tenant"}
        </Button>
      </div>
    </form>
  );
}
