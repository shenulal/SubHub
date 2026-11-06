"use client";

/** Add a platform super admin (temporary password, must change at first sign-in). */
import { createPlatformAdmin } from "@/actions/super-admin/platform-admins";
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
import { ShieldPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CredentialReveal } from "../credential-reveal";

const EMPTY = { name: "", email: "", password: "" };

export function AddPlatformAdminDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const close = (o: boolean) => {
    setOpen(o);
    if (!o) {
      setForm(EMPTY);
      setError(null);
      setGenerated(null);
    }
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      setError(null);
      const result = await createPlatformAdmin(form);
      if (!result.success) {
        setError(
          result.error ??
            result.message ??
            "The platform admin could not be added."
        );
        return;
      }
      toast.success(result.message ?? "Platform admin added.");
      router.refresh();
      if (result.data?.temporaryPassword)
        setGenerated(result.data.temporaryPassword);
      else close(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogTrigger asChild>
        <Button>
          <ShieldPlus />
          Add platform admin
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add platform admin</DialogTitle>
          <DialogDescription>
            Platform admins operate the Control Panel. They are not members of
            any tenant.
          </DialogDescription>
        </DialogHeader>
        {generated ? (
          <>
            <CredentialReveal
              label="Temporary password"
              value={generated}
              hint={`Share it with ${form.email} securely. Shown only once; it must be changed at the first sign-in.`}
            />
            <DialogFooter>
              <Button onClick={() => close(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="pa-name">Full name</Label>
              <Input
                id="pa-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pa-email">Email</Label>
              <Input
                id="pa-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pa-password">Temporary password (optional)</Label>
              <Input
                id="pa-password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Leave empty to generate one"
              />
            </div>
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
                {pending ? "Adding…" : "Add platform admin"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
