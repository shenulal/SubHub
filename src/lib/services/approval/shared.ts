// src/lib/services/approval/shared.ts
/**
 * Pieces shared by the submit / decision / reminder services: typed errors,
 * the request loader, metadata accessors and the "who may decide" rule.
 */
import { prisma } from "@/lib/db";
import { getSetting } from "@/lib/settings/service";
import type { ApprovalRequestMetadata } from "@/types/approval";
import type { ApprovalPolicy, ApprovalStep, Prisma } from "@prisma/client";

export type Db = Prisma.TransactionClient | typeof prisma;

export type ApprovalErrorCode =
  | "NOT_FOUND"
  | "NOT_PENDING"
  | "NOT_APPROVER"
  | "NOT_REQUESTER"
  | "FORBIDDEN"
  | "INVALID_STATE"
  | "INVALID_INPUT";

export class ApprovalError extends Error {
  constructor(
    public readonly code: ApprovalErrorCode,
    message: string
  ) {
    super(message);
    this.name = "ApprovalError";
  }
}

export function isApprovalError(error: unknown): error is ApprovalError {
  return error instanceof ApprovalError;
}

export interface Actor {
  userId: string;
  role: string;
  permissions: Set<string>;
}

export const REQUEST_INCLUDE = {
  steps: { orderBy: { stepOrder: "asc" as const } },
  policy: true,
  requester: { select: { id: true, name: true, email: true } },
} satisfies Prisma.ApprovalRequestInclude;

export type LoadedRequest = Prisma.ApprovalRequestGetPayload<{
  include: typeof REQUEST_INCLUDE;
}>;

export async function loadRequest(
  db: Db,
  organizationId: string,
  requestId: string
): Promise<LoadedRequest> {
  const request = await db.approvalRequest.findFirst({
    where: { id: requestId, organizationId },
    include: REQUEST_INCLUDE,
  });
  if (!request)
    throw new ApprovalError("NOT_FOUND", "Approval request not found");
  return request;
}

export function readMetadata(
  request: Pick<LoadedRequest, "metadata">
): ApprovalRequestMetadata {
  const raw = request.metadata;
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as ApprovalRequestMetadata)
    : {};
}

export function toJson(value: ApprovalRequestMetadata): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export function currentStepOf(
  request: Pick<LoadedRequest, "steps" | "currentStep">
): ApprovalStep | undefined {
  return request.steps.find((s) => s.stepOrder === request.currentStep);
}

export function nextWaitingStep(
  request: Pick<LoadedRequest, "steps" | "currentStep">
): ApprovalStep | undefined {
  return request.steps
    .filter((s) => s.stepOrder > request.currentStep && s.status === "WAITING")
    .sort((a, b) => a.stepOrder - b.stepOrder)[0];
}

export function candidatesForStep(
  request: Pick<LoadedRequest, "metadata">,
  step: ApprovalStep
): string[] {
  const meta = readMetadata(request);
  const listed = meta.stepCandidates?.[String(step.stepOrder)] ?? [];
  return Array.from(new Set([step.approverId, ...listed]));
}

/** Administrators may decide any pending request (single rule for all callers). */
export function isAdminRole(role: string | null | undefined): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function isAdmin(actor: Pick<Actor, "role">): boolean {
  return isAdminRole(actor.role);
}

export function canDecide(
  actor: Actor,
  request: Pick<LoadedRequest, "metadata">,
  step: ApprovalStep
): boolean {
  if (isAdmin(actor)) return true;
  const meta = readMetadata(request);
  if (meta.candidateIds?.includes(actor.userId)) return true;
  return candidatesForStep(request, step).includes(actor.userId);
}

export function toRef(request: LoadedRequest) {
  return {
    id: request.id,
    organizationId: request.organizationId,
    serviceName: request.serviceName,
    requesterName: request.requester.name ?? request.requester.email,
    monthlyAmount: Number(request.monthlyAmount),
    currency: request.currency,
  };
}

export async function reminderDaysFor(
  organizationId: string,
  policy: Pick<ApprovalPolicy, "reminderAfterDays"> | null
): Promise<number> {
  if (
    policy?.reminderAfterDays !== null &&
    policy?.reminderAfterDays !== undefined
  )
    return policy.reminderAfterDays;
  return getSetting(organizationId, "approvals.defaultReminderAfterDays");
}

export async function escalationDaysFor(
  organizationId: string,
  policy: Pick<ApprovalPolicy, "escalationAfterDays"> | null
): Promise<number> {
  if (
    policy?.escalationAfterDays !== null &&
    policy?.escalationAfterDays !== undefined
  )
    return policy.escalationAfterDays;
  return getSetting(organizationId, "approvals.defaultEscalationAfterDays");
}
