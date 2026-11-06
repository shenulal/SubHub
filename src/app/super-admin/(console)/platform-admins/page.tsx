// src/app/super-admin/(console)/platform-admins/page.tsx
/** Platform super admins: list, add, disable / enable, reset password. */
import { listPlatformAdmins } from "@/actions/super-admin/platform-admins";
import { formatPanelDate } from "@/components/super-admin/format";
import { PageHeading } from "@/components/super-admin/page-heading";
import { AddPlatformAdminDialog } from "@/components/super-admin/platform/add-platform-admin-dialog";
import { PlatformAdminStatusButton } from "@/components/super-admin/platform/platform-admin-status-button";
import { ResetPasswordDialog } from "@/components/super-admin/reset-password-dialog";
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
import { getSystemSetting } from "@/lib/settings/service";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Platform admins" };

export default async function PlatformAdminsPage() {
  const [result, timeZone] = await Promise.all([
    listPlatformAdmins(),
    getSystemSetting("general.timezone"),
  ]);
  const rows = result.data ?? [];
  const activeCount = rows.filter((r) => r.status === "ACTIVE").length;
  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        title="Platform admins"
        subtitle="Operators of the SubHub Control Panel. They manage tenants and the platform and are never members of a tenant."
        actions={<AddPlatformAdminDialog />}
      />
      <Card>
        <CardHeader>
          <CardTitle>Super administrators</CardTitle>
          <CardDescription>
            At least one active platform admin must remain. Bootstrap the first
            one with npm run platform:create-super-admin.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {!result.success ? (
            <p className="tonal-error mx-5 rounded-md p-3 text-[0.875rem]">
              {result.error}
            </p>
          ) : (
            <Table data-testid="platform-admins-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last sign-in</TableHead>
                  <TableHead className="hidden 2xl:table-cell">Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="max-w-[180px]">
                      <span
                        className="block truncate font-medium"
                        title={r.name ?? undefined}
                      >
                        {r.name ?? "—"}
                      </span>
                      {r.isCurrentUser && (
                        <span className="text-muted-foreground text-[0.75rem]">
                          You
                        </span>
                      )}
                    </TableCell>
                    <TableCell
                      className="text-muted-foreground max-w-[220px] truncate"
                      title={r.email}
                    >
                      {r.email}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1.5">
                        <Badge
                          variant={
                            r.status === "ACTIVE" ? "success" : "neutral"
                          }
                        >
                          {r.status === "ACTIVE" ? "Active" : "Disabled"}
                        </Badge>
                        {r.mustChangePassword && (
                          <Badge variant="warning">Must change password</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap tabular-nums">
                      {formatPanelDate(r.lastLoginAt, timeZone)}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden whitespace-nowrap tabular-nums 2xl:table-cell">
                      {formatPanelDate(r.createdAt, timeZone)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <ResetPasswordDialog
                          target={{
                            kind: "platform-admin",
                            userId: r.id,
                            email: r.email,
                          }}
                        />
                        <PlatformAdminStatusButton
                          userId={r.id}
                          email={r.email}
                          active={r.status === "ACTIVE"}
                          disabled={
                            r.isCurrentUser ||
                            (r.status === "ACTIVE" && activeCount <= 1)
                          }
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
