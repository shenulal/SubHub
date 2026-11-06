"use client";

/** Disable / enable a platform admin (confirmation; last active admin protected server-side). */
import { setPlatformAdminActive } from "@/actions/super-admin/platform-admins";
import { ConfirmAction } from "@/components/common/confirm-action";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

export function PlatformAdminStatusButton({
  userId,
  email,
  active,
  disabled,
}: {
  userId: string;
  email: string;
  active: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const apply = () =>
    startTransition(async () => {
      const result = await setPlatformAdminActive({ userId, active: !active });
      if (result.success) {
        toast.success(result.message ?? "Saved.");
        router.refresh();
      } else {
        toast.error(
          result.error ?? result.message ?? "The change could not be saved."
        );
      }
    });
  if (!active) {
    return (
      <Button size="sm" variant="outline" onClick={apply} disabled={pending}>
        Enable
      </Button>
    );
  }
  return (
    <ConfirmAction
      title={`Disable ${email}?`}
      description="They are signed out of the Control Panel immediately and cannot sign in until enabled again."
      confirmLabel="Disable"
      onConfirm={apply}
    >
      <Button
        size="sm"
        variant="outline"
        className="text-error hover:text-error"
        disabled={pending || disabled}
        title={disabled ? "You cannot disable your own account" : undefined}
      >
        Disable
      </Button>
    </ConfirmAction>
  );
}
