// src/lib/services/approval/notifications.ts
/**
 * Thin wrappers around the notification centre for approval events. Subject and
 * body copy is deliberately plain so it reads well in both in-app and email.
 */
import { notify } from "@/lib/services/notification/center";
import { getBaseUrl } from "@/lib/services/notification/email.utils";

export interface ApprovalNotifyRef {
  id: string;
  organizationId: string;
  serviceName: string;
  requesterName?: string | null;
  monthlyAmount?: number;
  currency?: string;
}

function linkFor(ref: ApprovalNotifyRef): string {
  return `/approvals/${ref.id}`;
}

function absoluteLink(ref: ApprovalNotifyRef): string {
  return `${getBaseUrl()}${linkFor(ref)}`;
}

function amountLine(ref: ApprovalNotifyRef): string {
  if (ref.monthlyAmount === undefined || !ref.currency) return "";
  return ` (${ref.currency} ${ref.monthlyAmount.toLocaleString()} / month)`;
}

function html(title: string, body: string, ref: ApprovalNotifyRef): string {
  return `<p>${title}</p><p>${body}</p><p><a href="${absoluteLink(ref)}">Open the request</a></p>`;
}

export async function notifyApprovalRequested(
  ref: ApprovalNotifyRef,
  userIds: string[],
  dedupeSuffix: string
) {
  if (userIds.length === 0) return;
  const title = `Approval requested: ${ref.serviceName}`;
  const body = `${ref.requesterName ?? "A colleague"} is requesting ${ref.serviceName}${amountLine(ref)}. Your decision is needed.`;
  await notify({
    organizationId: ref.organizationId,
    userIds,
    type: "APPROVAL_REQUESTED",
    title,
    body,
    link: linkFor(ref),
    dedupeKey: `approval:${ref.id}:requested:${dedupeSuffix}`,
    metadata: { requestId: ref.id },
    email: { subject: title, html: html(title, body, ref), text: body },
  });
}

export async function notifyRequesterDecided(
  ref: ApprovalNotifyRef,
  requesterId: string,
  status: "APPROVED" | "REJECTED",
  comment?: string | null
) {
  const verb = status === "APPROVED" ? "approved" : "rejected";
  const title = `Your request for ${ref.serviceName} was ${verb}`;
  const body = comment
    ? `Reviewer comment: ${comment}`
    : `The request for ${ref.serviceName} has been ${verb}.`;
  await notify({
    organizationId: ref.organizationId,
    userIds: [requesterId],
    type: "APPROVAL_DECIDED",
    title,
    body,
    link: linkFor(ref),
    dedupeKey: `approval:${ref.id}:decided:${status}`,
    metadata: { requestId: ref.id, status },
    email: { subject: title, html: html(title, body, ref), text: body },
  });
}

export async function notifyInfoRequested(
  ref: ApprovalNotifyRef,
  requesterId: string,
  comment: string
) {
  const title = `More information needed: ${ref.serviceName}`;
  const body = `The approver asked: ${comment}`;
  await notify({
    organizationId: ref.organizationId,
    userIds: [requesterId],
    type: "APPROVAL_INFO_REQUESTED",
    title,
    body,
    link: linkFor(ref),
    dedupeKey: `approval:${ref.id}:info:${Date.now()}`,
    metadata: { requestId: ref.id },
    email: { subject: title, html: html(title, body, ref), text: body },
  });
}

export async function notifyReminder(
  ref: ApprovalNotifyRef,
  userIds: string[]
) {
  if (userIds.length === 0) return;
  const title = `Reminder: ${ref.serviceName} is waiting for your decision`;
  const body = `${ref.requesterName ?? "A colleague"} is still waiting on ${ref.serviceName}${amountLine(ref)}.`;
  await notify({
    organizationId: ref.organizationId,
    userIds,
    type: "APPROVAL_REQUESTED",
    title,
    body,
    link: linkFor(ref),
    dedupeKey: `approval:${ref.id}:reminder:${Date.now()}`,
    metadata: { requestId: ref.id, reminder: true },
    email: { subject: title, html: html(title, body, ref), text: body },
  });
}

export async function notifyEscalated(
  ref: ApprovalNotifyRef,
  userIds: string[]
) {
  if (userIds.length === 0) return;
  const title = `Escalated: ${ref.serviceName} needs a decision`;
  const body = `The request from ${ref.requesterName ?? "a colleague"} for ${ref.serviceName}${amountLine(ref)} has been idle and was escalated to you.`;
  await notify({
    organizationId: ref.organizationId,
    userIds,
    type: "APPROVAL_ESCALATED",
    title,
    body,
    link: linkFor(ref),
    dedupeKey: `approval:${ref.id}:escalated`,
    metadata: { requestId: ref.id },
    email: { subject: title, html: html(title, body, ref), text: body },
  });
}

export async function notifyExpired(
  ref: ApprovalNotifyRef,
  requesterId: string
) {
  const title = `Request expired: ${ref.serviceName}`;
  const body = `Your request for ${ref.serviceName} was automatically cancelled because no decision was made in time.`;
  await notify({
    organizationId: ref.organizationId,
    userIds: [requesterId],
    type: "APPROVAL_DECIDED",
    title,
    body,
    link: linkFor(ref),
    dedupeKey: `approval:${ref.id}:expired`,
    metadata: { requestId: ref.id, expired: true },
    email: { subject: title, html: html(title, body, ref), text: body },
  });
}
