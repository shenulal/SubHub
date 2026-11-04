// src/actions/platform/privacy-bundle.ts
/**
 * Builds the "export my data" bundle for one member: a JSON document plus
 * CSV files, zipped with the dependency-free writer in the storage module.
 */
import { prisma } from "@/lib/db";
import { buildZip, type ZipEntry } from "@/lib/services/storage";

export const EXPORT_FORMAT = "ZIP";
export const EXPORT_CONTENT_TYPE = "application/zip";
const BUNDLE_VERSION = 1;

type Row = Record<string, unknown>;

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Rows → CSV text (UTF-8 BOM for spreadsheet friendliness). */
export function rowsToCsv(rows: Row[], columns?: string[]): string {
  const cols =
    columns ??
    Array.from(
      rows.reduce<Set<string>>((set, r) => {
        Object.keys(r).forEach((k) => set.add(k));
        return set;
      }, new Set())
    );
  const lines = [
    cols.join(","),
    ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(",")),
  ];
  return `﻿${lines.join("\n")}\n`;
}

export interface ExportBundle {
  zip: Buffer;
  fileCount: number;
}

export async function collectUserData(organizationId: string, userId: string) {
  const [
    user,
    subscriptions,
    approvalRequests,
    notifications,
    preferences,
    auditLogs,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        roleId: true,
        department: true,
        jobTitle: true,
        employeeId: true,
        teamId: true,
        preferences: true,
        createdAt: true,
        lastLoginAt: true,
      },
    }),
    prisma.subscription.findMany({
      where: { organizationId, ownerId: userId },
      include: {
        tags: { include: { tag: { select: { name: true } } } },
        customFieldValues: {
          include: { field: { select: { key: true, label: true } } },
        },
        comments: {
          select: { id: true, body: true, authorId: true, createdAt: true },
        },
      },
    }),
    prisma.approvalRequest.findMany({
      where: { organizationId, requesterId: userId },
    }),
    prisma.notification.findMany({
      where: { organizationId, userId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.notificationPreference.findMany({ where: { userId } }),
    prisma.auditLog.findMany({
      where: {
        organizationId,
        OR: [{ userId }, { entityType: "User", entityId: userId }],
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return {
    user,
    subscriptions,
    approvalRequests,
    notifications,
    preferences,
    auditLogs,
  };
}

type Collected = Awaited<ReturnType<typeof collectUserData>>;

function subscriptionRows(subs: Collected["subscriptions"]): Row[] {
  return subs.map((s) => ({
    id: s.id,
    amount: Number(s.amount),
    currency: s.currency,
    billingCycle: s.billingCycle,
    status: s.status,
    startDate: s.startDate,
    renewalDate: s.renewalDate,
    endDate: s.endDate,
    tags: s.tags.map((t) => t.tag.name).join("; "),
    customFields: s.customFieldValues
      .map((v) => `${v.field.key}=${v.value}`)
      .join("; "),
    commentCount: s.comments.length,
  }));
}

export function buildBundleEntries(
  data: Collected,
  generatedAt: Date
): ZipEntry[] {
  const json = {
    version: BUNDLE_VERSION,
    generatedAt: generatedAt.toISOString(),
    profile: data.user,
    subscriptions: data.subscriptions.map((s) => ({
      ...s,
      amount: Number(s.amount),
      tags: s.tags.map((t) => t.tag.name),
      customFields: Object.fromEntries(
        s.customFieldValues.map((v) => [v.field.key, v.value])
      ),
    })),
    approvalRequests: data.approvalRequests.map((r) => ({
      ...r,
      amount: Number(r.amount),
      monthlyAmount: Number(r.monthlyAmount),
    })),
    notifications: data.notifications,
    notificationPreferences: data.preferences,
    auditLog: data.auditLogs,
  };
  return [
    { name: "data.json", data: JSON.stringify(json, null, 2) },
    {
      name: "subscriptions.csv",
      data: rowsToCsv(subscriptionRows(data.subscriptions)),
    },
    {
      name: "approval-requests.csv",
      data: rowsToCsv(
        data.approvalRequests.map((r) => ({
          id: r.id,
          serviceName: r.serviceName,
          amount: Number(r.amount),
          currency: r.currency,
          billingCycle: r.billingCycle,
          status: r.status,
          submittedAt: r.submittedAt,
          decidedAt: r.decidedAt,
        }))
      ),
    },
    {
      name: "notifications.csv",
      data: rowsToCsv(
        data.notifications.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          readAt: n.readAt,
          createdAt: n.createdAt,
        }))
      ),
    },
    {
      name: "audit-log.csv",
      data: rowsToCsv(
        data.auditLogs.map((a) => ({
          id: a.id,
          action: a.action,
          entityType: a.entityType,
          entityId: a.entityId,
          createdAt: a.createdAt,
        }))
      ),
    },
  ];
}

export async function buildUserExportBundle(
  organizationId: string,
  userId: string,
  now: Date = new Date()
): Promise<ExportBundle> {
  const data = await collectUserData(organizationId, userId);
  const entries = buildBundleEntries(data, now);
  return { zip: buildZip(entries, now), fileCount: entries.length };
}
