"use client";

/** SaaS: delete a tenant after typing its exact name (soft delete, data retained). */
import { deleteTenant } from "@/actions/super-admin/tenant-lifecycle";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

export function DeleteTenantDialog({
  organizationId,
  tenantName,
}: {
  organizationId: string;
  tenantName: string;
}) {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const matches = typed.trim() === tenantName;

  const submit = () =>
    startTransition(async () => {
      const result = await deleteTenant({ organizationId, confirmName: typed });
      if (!result.success) {
        setError(
          result.error ?? result.message ?? "The tenant could not be deleted."
        );
        return;
      }
      toast.success(result.message ?? "Tenant deleted.");
      router.push("/super-admin/tenants");
      router.refresh();
    });

  return (
    <Dialog
      onOpenChange={(o) => {
        if (!o) {
          setTyped("");
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="text-error hover:text-error hover:border-error/60 hover:bg-error/[0.06]"
        >
          <Trash2 />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {tenantName}?</DialogTitle>
          <DialogDescription>
            Members lose access immediately and the tenant disappears from the
            Control Panel. Its data is retained for the retention period and its
            domain is released. This cannot be undone from the panel.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-tenant-name">
            Type{" "}
            <span className="text-foreground font-semibold">{tenantName}</span>{" "}
            to confirm
          </Label>
          <Input
            id="confirm-tenant-name"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
          />
          {error && (
            <p role="alert" className="text-error text-[0.8125rem]">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={!matches || pending}
          >
            {pending ? "Deleting…" : "Delete tenant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
