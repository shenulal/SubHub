"use client";

/**
 * Reset a password from the Control Panel (tenant admin or platform admin). The
 * operator types a temporary password or lets the server generate one; the user
 * must change it at the next sign-in.
 */
import { resetPlatformAdminPassword } from "@/actions/super-admin/platform-admins";
import { resetTenantAdminPassword } from "@/actions/super-admin/tenant-admins";
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
import { KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CredentialReveal } from "./credential-reveal";

type Target =
  | {
      kind: "tenant-admin";
      organizationId: string;
      userId: string;
      email: string;
    }
  | { kind: "platform-admin"; userId: string; email: string };

export function ResetPasswordDialog({ target }: { target: Target }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [generated, setGenerated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setPassword("");
    setGenerated(null);
    setError(null);
  };
  const submit = () =>
    startTransition(async () => {
      setError(null);
      const result =
        target.kind === "tenant-admin"
          ? await resetTenantAdminPassword({
              organizationId: target.organizationId,
              userId: target.userId,
              password,
            })
          : await resetPlatformAdminPassword({
              userId: target.userId,
              password,
            });
      if (!result.success) {
        setError(
          result.error ?? result.message ?? "The password could not be reset."
        );
        return;
      }
      toast.success(result.message ?? "Password reset.");
      router.refresh();
      if (result.data?.temporaryPassword)
        setGenerated(result.data.temporaryPassword);
      else setOpen(false);
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <KeyRound />
          Reset password
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription className="truncate">
            {target.email}
          </DialogDescription>
        </DialogHeader>
        {generated ? (
          <CredentialReveal
            label="Temporary password"
            value={generated}
            hint="Shown only once. It must be changed at the next sign-in."
          />
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor={`reset-${target.userId}`}>
              New temporary password (optional)
            </Label>
            <Input
              id={`reset-${target.userId}`}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave empty to generate one"
            />
            {error && (
              <p role="alert" className="text-error text-[0.8125rem]">
                {error}
              </p>
            )}
          </div>
        )}
        <DialogFooter>
          {generated ? (
            <Button onClick={() => setOpen(false)}>Done</Button>
          ) : (
            <Button onClick={submit} disabled={pending}>
              {pending ? "Resetting…" : "Reset password"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
