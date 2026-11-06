// src/components/super-admin/tenants/tenant-admins-card.tsx
/** Tenant Admins of one tenant: list, pending invitations, add, reset password. */
import type { TenantDetail } from "@/actions/super-admin/tenants";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPanelDate } from "../format";
import { ResetPasswordDialog } from "../reset-password-dialog";
import { AddTenantAdminDialog } from "./add-tenant-admin-dialog";

export function TenantAdminsCard({
  detail,
  timeZone,
}: {
  detail: TenantDetail;
  timeZone: string;
}) {
  return (
    <Card data-testid="tenant-admins">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <CardTitle>Tenant admins</CardTitle>
          <CardDescription>
            Administrators of this tenant&apos;s workspace. They cannot open the
            Control Panel.
          </CardDescription>
        </div>
        <AddTenantAdminDialog
          organizationId={detail.id}
          tenantName={detail.name}
        />
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-0">
        {detail.admins.length === 0 ? (
          <p className="text-muted-foreground px-5 text-[0.875rem]">
            No administrator has joined yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last sign-in</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.admins.map((a) => (
                <TableRow key={a.id}>
                  <TableCell
                    className="max-w-[200px] truncate font-medium"
                    title={a.name ?? undefined}
                  >
                    {a.name ?? "—"}
                  </TableCell>
                  <TableCell
                    className="text-muted-foreground max-w-[260px] truncate"
                    title={a.email}
                  >
                    {a.email}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1.5">
                      <Badge
                        variant={a.status === "ACTIVE" ? "success" : "neutral"}
                      >
                        {a.status === "ACTIVE" ? "Active" : "Inactive"}
                      </Badge>
                      {a.mustChangePassword && (
                        <Badge variant="warning">Must change password</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap tabular-nums">
                    {formatPanelDate(a.lastLoginAt, timeZone)}
                  </TableCell>
                  <TableCell className="text-right">
                    <ResetPasswordDialog
                      target={{
                        kind: "tenant-admin",
                        organizationId: detail.id,
                        userId: a.id,
                        email: a.email,
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {detail.pendingAdminInvitations.length > 0 && (
          <div className="mx-5 rounded-md border p-3">
            <p className="text-foreground mb-2 text-[0.875rem] font-medium">
              Pending invitations
            </p>
            <ul className="space-y-1.5">
              {detail.pendingAdminInvitations.map((i) => (
                <li
                  key={i.id}
                  className="flex min-w-0 items-center justify-between gap-3 text-[0.875rem]"
                >
                  <span className="truncate" title={i.email}>
                    {i.email}
                  </span>
                  <span className="text-muted-foreground shrink-0">
                    Expires {formatPanelDate(i.expiresAt, timeZone)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
