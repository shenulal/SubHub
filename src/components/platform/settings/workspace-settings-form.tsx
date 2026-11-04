"use client";

import { Button } from "@/components/ui/button";
import type { ActionState } from "@/types";
import { SECRET_UNCHANGED, type SettingsGroupPayload } from "@/types/platform";
import { Loader2, Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { SettingField } from "./setting-field";

type Values = Record<string, unknown>;

interface WorkspaceSettingsFormProps {
  payload: SettingsGroupPayload;
  canManage: boolean;
  saveAction: (
    group: string,
    values: Values
  ) => Promise<ActionState<{ updatedKeys: string[] }>>;
  resetAction: (key: string) => Promise<ActionState<{ value: unknown }>>;
}

function initialValues(payload: SettingsGroupPayload): Values {
  return Object.fromEntries(
    payload.definitions.map((d) => [
      d.key,
      d.sensitive ? SECRET_UNCHANGED : d.value,
    ])
  );
}

function parseJsonFields(
  payload: SettingsGroupPayload,
  values: Values
): Values {
  const out: Values = { ...values };
  for (const def of payload.definitions) {
    if (def.input === "json" && typeof out[def.key] === "string") {
      out[def.key] = JSON.parse(out[def.key] as string);
    }
  }
  return out;
}

export function WorkspaceSettingsForm({
  payload,
  canManage,
  saveAction,
  resetAction,
}: WorkspaceSettingsFormProps) {
  const t = useTranslations("platform.settings");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [baseline, setBaseline] = useState<Values>(() =>
    initialValues(payload)
  );
  const [values, setValues] = useState<Values>(baseline);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const dirtyKeys = useMemo(
    () =>
      Object.keys(values).filter(
        (k) => JSON.stringify(values[k]) !== JSON.stringify(baseline[k])
      ),
    [values, baseline]
  );

  const handleSave = () => {
    if (dirtyKeys.length === 0) return;
    let changed: Values;
    try {
      changed = parseJsonFields(
        payload,
        Object.fromEntries(dirtyKeys.map((k) => [k, values[k]]))
      );
    } catch {
      toast.error(t("invalidJson"));
      return;
    }
    startTransition(async () => {
      const result = await saveAction(payload.group, changed);
      if (result.success) {
        setFieldErrors({});
        setBaseline(values);
        toast.success(t("saved"));
        router.refresh();
      } else {
        setFieldErrors(result.errors ?? {});
        toast.error(result.error ?? t("saveFailed"));
      }
    });
  };

  const handleReset = (key: string) => {
    startTransition(async () => {
      const result = await resetAction(key);
      if (result.success) {
        const next = { ...values, [key]: result.data?.value };
        setValues(next);
        setBaseline((b) => ({ ...b, [key]: result.data?.value }));
        toast.success(t("resetDone"));
        router.refresh();
      } else {
        toast.error(result.error ?? t("saveFailed"));
      }
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
      className="space-y-6"
    >
      <header className="space-y-1">
        <h3 className="text-lg font-semibold tracking-tight">
          {payload.label}
        </h3>
        <p className="text-muted-foreground text-sm">{payload.description}</p>
      </header>

      <div>
        {payload.definitions.map((definition) => (
          <div key={definition.key}>
            <SettingField
              definition={definition}
              value={values[definition.key]}
              onChange={(v) =>
                setValues((prev) => ({ ...prev, [definition.key]: v }))
              }
              onReset={() => handleReset(definition.key)}
              disabled={!canManage || isPending}
              isDirty={dirtyKeys.includes(definition.key)}
            />
            {fieldErrors[definition.key] && (
              <p className="text-destructive -mt-3 pb-3 text-xs">
                {fieldErrors[definition.key].join(", ")}
              </p>
            )}
          </div>
        ))}
      </div>

      {canManage && (
        <div className="bg-background/95 sticky bottom-0 -mx-6 flex items-center justify-between border-t px-6 py-3 backdrop-blur">
          <span className="text-muted-foreground text-xs">
            {dirtyKeys.length > 0
              ? t("pendingChanges", { count: dirtyKeys.length })
              : t("noChanges")}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={dirtyKeys.length === 0 || isPending}
              onClick={() => setValues(baseline)}
            >
              {t("discard")}
            </Button>
            <Button
              type="submit"
              disabled={dirtyKeys.length === 0 || isPending}
            >
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {isPending ? t("saving") : t("save")}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
