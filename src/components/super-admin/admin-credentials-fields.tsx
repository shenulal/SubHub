"use client";

/**
 * Tenant Admin fields shared by "Create tenant" and "Add tenant admin": name,
 * email and how they get access (invitation or temporary password).
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export interface AdminFieldsValue {
  name: string;
  email: string;
  method: "invite" | "password";
  password: string;
}

export const EMPTY_ADMIN: AdminFieldsValue = {
  name: "",
  email: "",
  method: "invite",
  password: "",
};

const METHODS = [
  {
    value: "invite",
    title: "Send an invitation",
    body: "They choose their own sign-in when they accept.",
  },
  {
    value: "password",
    title: "Set a temporary password",
    body: "They must change it at the first sign-in.",
  },
] as const;

export function AdminCredentialsFields({
  value,
  onChange,
  idPrefix,
}: {
  value: AdminFieldsValue;
  onChange: (next: AdminFieldsValue) => void;
  idPrefix: string;
}) {
  const set = (patch: Partial<AdminFieldsValue>) =>
    onChange({ ...value, ...patch });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor={`${idPrefix}-name`}>Full name</Label>
        <Input
          id={`${idPrefix}-name`}
          value={value.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="e.g. Aisha Rahman"
          required
        />
      </div>
      <div className="min-w-0 space-y-1.5">
        <Label htmlFor={`${idPrefix}-email`}>Work email</Label>
        <Input
          id={`${idPrefix}-email`}
          type="email"
          value={value.email}
          onChange={(e) => set({ email: e.target.value })}
          placeholder="name@company.com"
          required
        />
      </div>
      <RadioGroup
        value={value.method}
        onValueChange={(m) => set({ method: m as AdminFieldsValue["method"] })}
        className="grid gap-3 sm:col-span-2 sm:grid-cols-2"
        aria-label="Access method"
      >
        {METHODS.map((m) => (
          <Label
            key={m.value}
            htmlFor={`${idPrefix}-${m.value}`}
            className="has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/[0.06] flex min-w-0 cursor-pointer items-start gap-3 rounded-md border p-3 font-normal transition-colors"
          >
            <RadioGroupItem
              id={`${idPrefix}-${m.value}`}
              value={m.value}
              className="mt-0.5"
            />
            <span className="min-w-0 space-y-0.5">
              <span className="text-foreground block text-[0.9375rem] font-medium">
                {m.title}
              </span>
              <span className="text-muted-foreground block text-[0.8125rem] leading-snug whitespace-normal">
                {m.body}
              </span>
            </span>
          </Label>
        ))}
      </RadioGroup>
      {value.method === "password" && (
        <div className="min-w-0 space-y-1.5 sm:col-span-2">
          <Label htmlFor={`${idPrefix}-password`}>
            Temporary password (optional)
          </Label>
          <Input
            id={`${idPrefix}-password`}
            type="password"
            autoComplete="new-password"
            value={value.password}
            onChange={(e) => set({ password: e.target.value })}
            placeholder="Leave empty to generate a strong one"
          />
          <p className="text-muted-foreground text-[0.8125rem]">
            Upper and lower case letters, a number and a symbol. The minimum
            length follows the security settings.
          </p>
        </div>
      )}
    </div>
  );
}
