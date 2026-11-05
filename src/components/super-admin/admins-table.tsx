// src/components/super-admin/admins-table.tsx
"use client";

import {
  changeAdminRole,
  type AdminUserInfo,
} from "@/actions/super-admin/admin-users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState } from "react";
import { toast } from "sonner";

interface AdminsTableProps {
  admins: AdminUserInfo[];
}

export function AdminsTable({ admins: initialAdmins }: AdminsTableProps) {
  const [admins, setAdmins] = useState(initialAdmins);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleRoleChange = async (userId: string, currentRole: string) => {
    const newRole = currentRole === "ADMIN" ? "MEMBER" : "ADMIN";
    setLoadingId(userId);

    const result = await changeAdminRole(userId, newRole as "ADMIN" | "MEMBER");
    setLoadingId(null);

    if (result.success) {
      setAdmins((prev) =>
        prev.map((a) => (a.id === userId ? { ...a, role: newRole } : a))
      );
      toast.success(result.message ?? "Role updated.");
    } else {
      toast.error(result.message ?? "An error occurred.");
    }
  };

  if (admins.length === 0) {
    return (
      <div className="text-muted-foreground flex h-32 items-center justify-center text-sm">
        No admins found.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Joined</TableHead>
          <TableHead>Last Login</TableHead>
          <TableHead className="w-24">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {admins.map((admin) => (
          <TableRow key={admin.id}>
            <TableCell className="text-foreground font-medium">
              {admin.name ?? "-"}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {admin.email}
            </TableCell>
            <TableCell>
              <Badge variant={admin.role === "ADMIN" ? "primary" : "secondary"}>
                {admin.role === "ADMIN" ? "Admin" : "Member"}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {new Date(admin.createdAt).toLocaleDateString("en-US")}
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {admin.lastLoginAt
                ? new Date(admin.lastLoginAt).toLocaleDateString("en-US")
                : "-"}
            </TableCell>
            <TableCell>
              <Button
                variant="outline"
                size="sm"
                disabled={loadingId === admin.id}
                onClick={() => handleRoleChange(admin.id, admin.role)}
              >
                {loadingId === admin.id
                  ? "Updating..."
                  : admin.role === "ADMIN"
                    ? "Make Member"
                    : "Make Admin"}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
