import { IntegrationStatus, IntegrationType } from "@prisma/client";
import { z } from "zod";

export const integrationCreateSchema = z.object({
  type: z.enum(IntegrationType, {
    error: "Select an integration type",
  }),
  domain: z.string().optional(),
  adminEmail: z.string().email("Enter a valid email address").optional(),
  serviceAccountEmail: z
    .string()
    .email("Enter a valid email address")
    .optional(),
  privateKey: z.string().optional(),
});

export const integrationStatusSchema = z.object({
  status: z.enum(IntegrationStatus, {
    error: "Select a status",
  }),
});

export type IntegrationCreateValues = z.infer<typeof integrationCreateSchema>;
export type IntegrationStatusValues = z.infer<typeof integrationStatusSchema>;
