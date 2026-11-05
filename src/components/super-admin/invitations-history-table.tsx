// src/components/super-admin/invitations-history-table.tsx
"use client";

import {
  resendTenantInvitation,
  type TenantInvitationInfo,
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

const statusConfig: Record<
  string,
  {
    label: string;
    variant: "secondary" | "destructive" | "outline" | "success" | "warning";
  }
> = {
  PENDING: { label: "Pending", variant: "warning" },
  ACCEPTED: { label: "Accepted", variant: "success" },
  EXPIRED: { label: "Expired", variant: "destructive" },
  CANCELLED: { label: "Cancelled", variant: "secondary" },
};

interface InvitationsHistoryTableProps {
  invitations: TenantInvitationInfo[];
}

export function InvitationsHistoryTable({
  invitations: initialInvitations,
}: InvitationsHistoryTableProps) {
  const [invitations, setInvitations] = useState(initialInvitations);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleResend = async (id: string) => {
    setLoadingId(id);
    const result = await resendTenantInvitation(id);
    setLoadingId(null);

    if (result.success) {
      toast.success(result.message ?? "Invitation resent.");
      // Reflect the renewed expiry date
      setInvitations((prev) =>
        prev.map((inv) =>
          inv.id === id
            ? {
                ...inv,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              }
            : inv
        )
      );
    } else {
      toast.error(result.message ?? "Failed to resend the invitation.");
    }
  };

  if (invitations.length === 0) {
    return (
      <div className="text-muted-foreground flex h-32 items-center justify-center text-sm">
        No invitations sent.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Sent</TableHead>
          <TableHead>Expires</TableHead>
          <TableHead className="w-24">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invitations.map((inv) => {
          const status = statusConfig[inv.status] ?? {
            label: inv.status,
            variant: "outline" as const,
          };
          const isExpired = new Date() > new Date(inv.expiresAt);

          return (
            <TableRow key={inv.id}>
              <TableCell className="text-foreground font-medium">
                {inv.email}
              </TableCell>
              <TableCell>
                <Badge variant="primary">
                  {inv.role === "ADMIN" ? "Admin" : inv.role}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    isExpired && inv.status === "PENDING"
                      ? "destructive"
                      : status.variant
                  }
                >
                  {isExpired && inv.status === "PENDING"
                    ? "Expired"
                    : status.label}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {new Date(inv.createdAt).toLocaleDateString("en-US")}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {new Date(inv.expiresAt).toLocaleDateString("en-US")}
              </TableCell>
              <TableCell>
                {inv.status === "PENDING" && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loadingId === inv.id}
                    onClick={() => handleResend(inv.id)}
                  >
                    {loadingId === inv.id ? "Sending..." : "Resend"}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
