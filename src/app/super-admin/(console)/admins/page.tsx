// src/app/super-admin/admins/page.tsx
import {
  listTenantAdmins,
  listTenantInvitations,
} from "@/actions/super-admin/admin-users";
import { AdminsTable } from "@/components/super-admin/admins-table";
import { InvitationsHistoryTable } from "@/components/super-admin/invitations-history-table";
import { InviteAdminForm } from "@/components/super-admin/invite-admin-form";
import {
  SelectTenantCard,
  TenantScope,
} from "@/components/super-admin/tenant-scope";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isSaas } from "@/lib/deployment/mode";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Tenant admins",
};

interface PageProps {
  searchParams: Promise<{ org?: string }>;
}

export default async function AdminsPage({ searchParams }: PageProps) {
  const { org } = await searchParams;
  if (isSaas() && !org) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-foreground text-2xl font-medium">
            Tenant admins
          </h1>
          <p className="text-muted-foreground text-[0.9375rem]">
            Invite tenant administrators and manage their roles.
          </p>
        </div>
        <TenantScope />
        <SelectTenantCard purpose="invite and manage its administrators" />
      </div>
    );
  }
  const [result, invitationsResult] = await Promise.all([
    listTenantAdmins(org),
    listTenantInvitations(org),
  ]);

  const noTenant =
    !result.success && result.message === "Tenant information not found.";

  if (noTenant) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-foreground text-2xl font-medium">
            Tenant admins
          </h1>
          <p className="text-muted-foreground text-[0.9375rem]">
            Invite tenant administrators and manage their roles.
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <p className="text-muted-foreground text-[0.9375rem]">
              You need to create a tenant before inviting administrators.
            </p>
            <Button asChild>
              <Link
                href={
                  isSaas()
                    ? "/super-admin/tenants/new"
                    : "/super-admin/installation"
                }
              >
                Create tenant
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-foreground text-2xl font-medium">Tenant admins</h1>
        <p className="text-muted-foreground text-[0.9375rem]">
          Invite tenant administrators and manage their roles.
        </p>
      </div>

      <TenantScope selected={org} />

      {/* Invite admin */}
      <Card>
        <CardHeader>
          <CardTitle>Invite Admin</CardTitle>
          <CardDescription>
            Sends an invitation by email. The invitee joins with the ADMIN role.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteAdminForm organizationId={org} />
        </CardContent>
      </Card>

      {/* Invitation history */}
      <Card>
        <CardHeader>
          <CardTitle>Invitation History</CardTitle>
          <CardDescription>
            Status of sent invitations. Pending invitations can be resent.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {invitationsResult.success && invitationsResult.data ? (
            <InvitationsHistoryTable invitations={invitationsResult.data} />
          ) : (
            <div className="text-muted-foreground flex h-32 items-center justify-center text-sm">
              No invitations have been sent.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin list */}
      <Card>
        <CardHeader>
          <CardTitle>Administrators</CardTitle>
          <CardDescription>
            Users who currently have the ADMIN role.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {result.success && result.data ? (
            <AdminsTable admins={result.data} />
          ) : (
            <div className="text-muted-foreground flex h-32 items-center justify-center text-sm">
              {result.message ?? "Unable to load data."}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
