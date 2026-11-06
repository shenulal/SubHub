"use client";

/**
 * Shows a one-time secret the panel just created (temporary password or
 * invitation link) with a copy button. It is never stored or shown again.
 */
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CredentialReveal({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div
      className="tonal-warning flex min-w-0 flex-col gap-2 rounded-md p-3"
      data-testid="credential-reveal"
    >
      <span className="text-[0.8125rem] font-medium">{label}</span>
      <div className="flex min-w-0 items-center gap-2">
        <code
          className="bg-background text-foreground min-w-0 flex-1 truncate rounded px-2.5 py-2 font-mono text-[0.875rem]"
          title={value}
        >
          {value}
        </code>
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={copy}
          aria-label={`Copy ${label.toLowerCase()}`}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
      {hint && <p className="text-foreground/80 text-[0.8125rem]">{hint}</p>}
    </div>
  );
}

/** What the panel returns after provisioning an admin. */
export interface ProvisionedAdminView {
  email: string;
  method: "invite" | "password";
  temporaryPassword?: string;
  inviteUrl?: string;
  emailSent?: boolean;
}

export function ProvisionedAdminNotice({
  admin,
}: {
  admin: ProvisionedAdminView;
}) {
  if (admin.method === "password") {
    return admin.temporaryPassword ? (
      <CredentialReveal
        label="Temporary password"
        value={admin.temporaryPassword}
        hint={`Share it with ${admin.email} securely. It is shown only once and must be changed at the first sign-in.`}
      />
    ) : (
      <p className="tonal-success rounded-md p-3 text-[0.875rem]">
        {admin.email} can sign in with the password you set and must change it
        at the first sign-in.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      <p
        className={`${admin.emailSent ? "tonal-success" : "tonal-warning"} rounded-md p-3 text-[0.875rem]`}
      >
        {admin.emailSent
          ? `Invitation emailed to ${admin.email}.`
          : `The invitation for ${admin.email} was created, but the email could not be sent. Share the link below.`}
      </p>
      {admin.inviteUrl && !admin.emailSent && (
        <CredentialReveal label="Invitation link" value={admin.inviteUrl} />
      )}
    </div>
  );
}
