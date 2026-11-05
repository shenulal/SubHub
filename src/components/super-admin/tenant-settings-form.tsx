// src/components/super-admin/tenant-settings-form.tsx
"use client";

import {
  updateTenantDomain,
  updateTenantLogoUrl,
  updateTenantName,
  type TenantInfo,
} from "@/actions/super-admin/tenant-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";

interface TenantSettingsFormProps {
  tenant: TenantInfo;
}

export function TenantSettingsForm({ tenant }: TenantSettingsFormProps) {
  const [name, setName] = useState(tenant.name);
  const [domain, setDomain] = useState(tenant.domain ?? "");
  const [logoUrl, setLogoUrl] = useState(tenant.logoUrl ?? "");
  const [loading, setLoading] = useState<string | null>(null);

  const handleSaveName = async () => {
    setLoading("name");
    const result = await updateTenantName(tenant.id, name);
    setLoading(null);
    if (result.success) {
      toast.success(result.message ?? "Saved.");
    } else {
      toast.error(result.message ?? "An error occurred.");
    }
  };

  const handleSaveDomain = async () => {
    setLoading("domain");
    const result = await updateTenantDomain(tenant.id, domain);
    setLoading(null);
    if (result.success) {
      toast.success(result.message ?? "Saved.");
    } else {
      toast.error(result.message ?? "An error occurred.");
    }
  };

  const handleSaveLogo = async () => {
    setLoading("logo");
    const result = await updateTenantLogoUrl(tenant.id, logoUrl);
    setLoading(null);
    if (result.success) {
      toast.success(result.message ?? "Saved.");
    } else {
      toast.error(result.message ?? "An error occurred.");
    }
  };

  return (
    <div className="max-w-3xl space-y-5 [&_[data-slot=label]]:text-[0.9375rem]">
      {/* Company name */}
      <div className="space-y-2">
        <Label htmlFor="name">Company Name</Label>
        <div className="flex min-w-0 gap-2 [&>button]:h-10 [&>button]:shrink-0 [&>button]:px-[18px] [&>input]:min-w-0 [&>input]:flex-1">
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter the company name"
          />
          <Button
            onClick={handleSaveName}
            disabled={loading === "name" || name === tenant.name}
            size="sm"
          >
            {loading === "name" ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Domain */}
      <div className="space-y-2">
        <Label htmlFor="domain">Domain</Label>
        <div className="flex min-w-0 gap-2 [&>button]:h-10 [&>button]:shrink-0 [&>button]:px-[18px] [&>input]:min-w-0 [&>input]:flex-1">
          <Input
            id="domain"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="example.com"
          />
          <Button
            onClick={handleSaveDomain}
            disabled={loading === "domain" || domain === (tenant.domain ?? "")}
            size="sm"
          >
            {loading === "domain" ? "Saving..." : "Save"}
          </Button>
        </div>
        <p className="text-muted-foreground text-[0.8125rem]">
          e.g. example.com (without https://)
        </p>
      </div>

      {/* Logo URL */}
      <div className="space-y-2">
        <Label htmlFor="logo">Logo URL</Label>
        <div className="flex min-w-0 gap-2 [&>button]:h-10 [&>button]:shrink-0 [&>button]:px-[18px] [&>input]:min-w-0 [&>input]:flex-1">
          <Input
            id="logo"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://example.com/logo.png"
          />
          <Button
            onClick={handleSaveLogo}
            disabled={loading === "logo" || logoUrl === (tenant.logoUrl ?? "")}
            size="sm"
          >
            {loading === "logo" ? "Saving..." : "Save"}
          </Button>
        </div>
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt="Logo preview"
            className="h-12 w-auto max-w-full rounded-md border object-contain p-1"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}
      </div>
    </div>
  );
}
