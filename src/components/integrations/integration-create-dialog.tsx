// src/components/integrations/integration-create-dialog.tsx
// TODO: Register a Google Workspace Marketplace app
// - Current: users must create the Service Account and configure Domain-Wide Delegation themselves
// - Goal: after Marketplace registration, connect with just the OAuth consent screen
// - Reference: https://developers.google.com/workspace/marketplace
// - Priority: P1 (important for reducing onboarding friction)
"use client";

import { createIntegration } from "@/actions/integrations";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { zodResolver } from "@hookform/resolvers/zod";
import { IntegrationType } from "@prisma/client";
import {
  AlertCircle,
  ExternalLink,
  HelpCircle,
  Loader2,
  Shield,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

// Schema for the Google Workspace integration (stricter required fields)
const createIntegrationCreateSchema = (t: (key: string) => string) => {
  return z
    .object({
      type: z.enum(IntegrationType, {
        error: t("integrations.form.schema.typeRequired"),
      }),
      domain: z.string().optional(),
      adminEmail: z.string().optional(),
      serviceAccountEmail: z.string().optional(),
      privateKey: z.string().optional(),
    })
    .superRefine((data, ctx) => {
      // Validate required fields when Google Workspace is selected
      if (data.type === "GOOGLE_WORKSPACE") {
        if (!data.adminEmail || data.adminEmail.trim() === "") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t("integrations.form.schema.adminEmailRequired"),
            path: ["adminEmail"],
          });
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.adminEmail)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t("integrations.form.schema.adminEmailInvalid"),
            path: ["adminEmail"],
          });
        }

        if (
          !data.serviceAccountEmail ||
          data.serviceAccountEmail.trim() === ""
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t("integrations.form.schema.serviceAccountEmailRequired"),
            path: ["serviceAccountEmail"],
          });
        } else if (
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.serviceAccountEmail)
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t("integrations.form.schema.serviceAccountEmailInvalid"),
            path: ["serviceAccountEmail"],
          });
        }

        if (!data.privateKey || data.privateKey.trim() === "") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t("integrations.form.schema.privateKeyRequired"),
            path: ["privateKey"],
          });
        } else if (!data.privateKey.includes("-----BEGIN PRIVATE KEY-----")) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t("integrations.form.schema.privateKeyInvalid"),
            path: ["privateKey"],
          });
        }
      }
    });
};

type IntegrationCreateValues = z.infer<
  ReturnType<typeof createIntegrationCreateSchema>
>;

interface IntegrationCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function IntegrationCreateDialog({
  open,
  onOpenChange,
  onSuccess,
}: IntegrationCreateDialogProps) {
  const t = useTranslations();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<IntegrationCreateValues>({
    resolver: zodResolver(createIntegrationCreateSchema(t)),
    defaultValues: {
      type: "GOOGLE_WORKSPACE",
      domain: "",
      adminEmail: "",
      serviceAccountEmail: "",
      privateKey: "",
    },
  });

  const selectedType = watch("type");
  const isGoogleWorkspace = selectedType === "GOOGLE_WORKSPACE";

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);

    startTransition(async () => {
      const result = await createIntegration({
        type: values.type,
        credentials: {
          adminEmail: values.adminEmail || undefined,
          serviceAccountEmail: values.serviceAccountEmail || undefined,
          privateKey: values.privateKey || undefined,
        },
        metadata: {
          domain: values.domain || undefined,
        },
      });

      if (result.success) {
        reset();
        onOpenChange(false);
        onSuccess?.();
      } else {
        setSubmitError(
          result.error || t("integrations.form.error.createFailed")
        );
      }
    });
  });

  const handleClose = () => {
    reset();
    setSubmitError(null);
    onOpenChange(false);
  };

  const isLoading = isPending || isSubmitting;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("integrations.form.create.title")}</DialogTitle>
          <DialogDescription>
            {t("integrations.form.create.descriptionDialog")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-6">
          {submitError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          {/* Integration type selection */}
          <div className="space-y-2">
            <Label htmlFor="type">{t("integrations.list.columns.type")}</Label>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(value) =>
                    field.onChange(value as IntegrationType)
                  }
                  disabled={isLoading}
                >
                  <SelectTrigger id="type">
                    <SelectValue
                      placeholder={t(
                        "integrations.form.create.typePlaceholder"
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GOOGLE_WORKSPACE">
                      <div className="flex items-center gap-2">
                        <span>{t("integrations.type.googleWorkspace")}</span>
                        <span className="tonal-success rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap">
                          {t("integrations.type.recommended")}
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="OKTA" disabled>
                      <div className="flex items-center gap-2">
                        <span>{t("integrations.type.okta")}</span>
                        <span className="text-muted-foreground text-xs">
                          {t("integrations.type.comingSoon")}
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="AZURE_AD" disabled>
                      <div className="flex items-center gap-2">
                        <span>{t("integrations.type.microsoftEntra")}</span>
                        <span className="text-muted-foreground text-xs">
                          {t("integrations.type.comingSoon")}
                        </span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.type?.message && (
              <p className="text-destructive text-sm">{errors.type.message}</p>
            )}
          </div>

          {/* Google Workspace guidance */}
          {isGoogleWorkspace && (
            <Alert>
              <HelpCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">
                    {t("integrations.googleWorkspace.setupTitle")}
                  </p>
                  <ol className="text-muted-foreground list-inside list-decimal space-y-1 text-sm">
                    <li>{t("integrations.googleWorkspace.setupStep1")}</li>
                    <li>{t("integrations.googleWorkspace.setupStep2")}</li>
                    <li>{t("integrations.googleWorkspace.setupStep3")}</li>
                  </ol>
                  <a
                    href="https://developers.google.com/admin-sdk/directory/v1/guides/delegation"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
                  >
                    {t("integrations.googleWorkspace.setupGuide")}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Domain */}
          <div className="space-y-2">
            <Label htmlFor="domain">
              {t("integrations.form.create.domainOptional")}
            </Label>
            <Input
              id="domain"
              placeholder={t("integrations.form.create.domainPlaceholder")}
              disabled={isLoading}
              {...register("domain")}
            />
            <p className="text-muted-foreground text-xs">
              {t("integrations.form.create.domainHint")}
            </p>
          </div>

          {/* Google Workspace fields */}
          {isGoogleWorkspace && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {/* Admin email */}
                <div className="space-y-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Label
                          htmlFor="adminEmail"
                          className="flex cursor-help items-center gap-1"
                        >
                          {t("integrations.form.create.adminEmailLabel")}
                          <span className="text-destructive">*</span>
                          <HelpCircle className="text-muted-foreground h-3 w-3" />
                        </Label>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p>{t("integrations.form.create.adminEmailTooltip")}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Input
                    id="adminEmail"
                    type="email"
                    placeholder={t(
                      "integrations.form.create.adminEmailPlaceholder"
                    )}
                    disabled={isLoading}
                    {...register("adminEmail")}
                  />
                  {errors.adminEmail?.message && (
                    <p className="text-destructive text-sm">
                      {errors.adminEmail.message}
                    </p>
                  )}
                </div>

                {/* Service account email */}
                <div className="space-y-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Label
                          htmlFor="serviceAccountEmail"
                          className="flex cursor-help items-center gap-1"
                        >
                          {t(
                            "integrations.form.create.serviceAccountEmailLabel"
                          )}
                          <span className="text-destructive">*</span>
                          <HelpCircle className="text-muted-foreground h-3 w-3" />
                        </Label>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p>
                          {t(
                            "integrations.form.create.serviceAccountEmailTooltip"
                          )}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Input
                    id="serviceAccountEmail"
                    type="email"
                    placeholder={t(
                      "integrations.form.create.serviceAccountEmailPlaceholder"
                    )}
                    disabled={isLoading}
                    {...register("serviceAccountEmail")}
                  />
                  {errors.serviceAccountEmail?.message && (
                    <p className="text-destructive text-sm">
                      {errors.serviceAccountEmail.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Private Key */}
              <div className="space-y-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label
                        htmlFor="privateKey"
                        className="flex cursor-help items-center gap-2"
                      >
                        {t("integrations.form.create.privateKeyLabel")}
                        <span className="text-destructive">*</span>
                        <Shield className="text-muted-foreground h-4 w-4" />
                        <HelpCircle className="text-muted-foreground h-3 w-3" />
                      </Label>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p>{t("integrations.form.create.privateKeyTooltip")}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Textarea
                  id="privateKey"
                  placeholder={t(
                    "integrations.form.create.privateKeyPlaceholder"
                  )}
                  rows={5}
                  className="min-h-[120px] resize-y font-mono text-xs break-all"
                  disabled={isLoading}
                  {...register("privateKey")}
                />
                {errors.privateKey?.message && (
                  <p className="text-destructive text-sm">
                    {errors.privateKey.message}
                  </p>
                )}
                <p className="text-muted-foreground text-xs">
                  {t("integrations.form.create.privateKeyHint")}
                </p>
              </div>
            </>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              {t("integrations.actions.cancel")}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("integrations.actions.new")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
