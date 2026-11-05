// src/components/super-admin/tenant-status-button.tsx
"use client";

/** SaaS console: deactivate (suspend) or reactivate a tenant, with confirmation. */
import { setTenantActive } from "@/actions/super-admin/tenant-settings";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

export function TenantStatusButton({
  tenantId,
  tenantName,
  deactivated,
}: {
  tenantId: string;
  tenantName: string;
  deactivated: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const apply = () =>
    startTransition(async () => {
      const result = await setTenantActive(tenantId, deactivated);
      if (result.success) {
        toast.success(result.message ?? "Saved.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Failed to update the tenant.");
      }
    });

  if (deactivated) {
    return (
      <Button size="sm" variant="outline" onClick={apply} disabled={isPending}>
        Reactivate
      </Button>
    );
  }
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="text-error hover:text-error"
          disabled={isPending}
        >
          Deactivate
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deactivate {tenantName}?</AlertDialogTitle>
          <AlertDialogDescription>
            Members lose access immediately. Data, integrations and settings are
            kept, and you can reactivate the tenant at any time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={apply}>Deactivate</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
