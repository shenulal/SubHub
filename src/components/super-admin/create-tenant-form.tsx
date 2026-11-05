// src/components/super-admin/create-tenant-form.tsx
"use client";

import { createTenant } from "@/actions/super-admin/tenant-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export function CreateTenantForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter a company name.");
      return;
    }

    setLoading(true);
    const result = await createTenant(
      name.trim(),
      domain.trim() || undefined,
      logoUrl.trim() || undefined
    );
    setLoading(false);

    if (result.success) {
      toast.success("Tenant created.");
      setName("");
      setDomain("");
      setLogoUrl("");
      router.refresh();
    } else {
      toast.error(result.message ?? "Failed to create the tenant.");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-5 sm:grid-cols-2 [&_[data-slot=label]]:text-[0.9375rem]"
    >
      {/* Company name (required) */}
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor="name">
          Company Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. My Company"
          required
        />
      </div>

      {/* Domain (optional) */}
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor="domain">Domain (optional)</Label>
        <Input
          id="domain"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="e.g. example.com"
        />
        <p className="text-muted-foreground text-[0.8125rem]">
          Enter without https://
        </p>
      </div>

      {/* Logo URL (optional) */}
      <div className="min-w-0 space-y-1.5 sm:col-span-2">
        <Label htmlFor="logoUrl">Logo URL (optional)</Label>
        <Input
          id="logoUrl"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="https://example.com/logo.png"
        />
      </div>

      <div className="flex flex-wrap justify-end gap-3 sm:col-span-2">
        <Button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create Tenant"}
        </Button>
      </div>
    </form>
  );
}
