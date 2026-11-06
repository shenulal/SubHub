"use client";

/** Add another Tenant Admin (invitation or temporary password). */
import { addTenantAdmin } from "@/actions/super-admin/tenant-admins";
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
import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  AdminCredentialsFields,
  EMPTY_ADMIN,
  type AdminFieldsValue,
} from "../admin-credentials-fields";
import {
  ProvisionedAdminNotice,
  type ProvisionedAdminView,
} from "../credential-reveal";

export function AddTenantAdminDialog({
  organizationId,
  tenantName,
}: {
  organizationId: string;
  tenantName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [admin, setAdmin] = useState<AdminFieldsValue>(EMPTY_ADMIN);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ProvisionedAdminView | null>(null);
  const [pending, startTransition] = useTransition();

  const close = (o: boolean) => {
    setOpen(o);
    if (!o) {
      setAdmin(EMPTY_ADMIN);
      setError(null);
      setDone(null);
    }
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      setError(null);
      const result = await addTenantAdmin({ organizationId, ...admin });
      if (!result.success || !result.data) {
        setError(
          result.error ??
            result.message ??
            "The administrator could not be added."
        );
        return;
      }
      setDone(result.data);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus />
          Add tenant admin
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Add tenant admin</DialogTitle>
          <DialogDescription className="truncate">
            {tenantName}
          </DialogDescription>
        </DialogHeader>
        {done ? (
          <>
            <ProvisionedAdminNotice admin={done} />
            <DialogFooter>
              <Button onClick={() => close(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <AdminCredentialsFields
              value={admin}
              onChange={setAdmin}
              idPrefix="add-admin"
            />
            {error && (
              <p
                role="alert"
                className="tonal-error rounded-md p-3 text-[0.875rem]"
              >
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Adding…" : "Add admin"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
