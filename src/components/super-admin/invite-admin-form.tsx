// src/components/super-admin/invite-admin-form.tsx
"use client";

import { inviteTenantAdmin } from "@/actions/super-admin/admin-users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";

export function InviteAdminForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    const result = await inviteTenantAdmin(email.trim());
    setLoading(false);

    if (result.success) {
      toast.success(result.message ?? "Invitation sent.");
      setEmail("");
    } else {
      toast.error(result.message ?? "An error occurred.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="invite-email" className="text-[0.9375rem]">
          Email to invite
        </Label>
        <div className="flex min-w-0 flex-wrap gap-3 sm:flex-nowrap [&>button]:h-10 [&>button]:shrink-0 [&>input]:min-w-0 [&>input]:flex-1">
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@example.com"
            disabled={loading}
          />
          <Button type="submit" disabled={loading || !email.trim()}>
            {loading ? "Sending..." : "Send Invitation"}
          </Button>
        </div>
        <p className="text-muted-foreground text-[0.8125rem]">
          The user will be invited with the ADMIN role. The invitation link is
          valid for 7 days.
        </p>
      </div>
    </form>
  );
}
