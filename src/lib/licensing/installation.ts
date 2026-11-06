// src/lib/licensing/installation.ts
/**
 * Installation ID — generated once per database and stored in `system_settings`
 * (key `platform.installationId`). The licensing application binds licences to it.
 * Not a tunable, so it is deliberately not part of the settings registry.
 */
import { prisma } from "@/lib/db";
import { randomUUID } from "node:crypto";
import { cache } from "react";

export const INSTALLATION_ID_KEY = "platform.installationId";

function readId(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id: unknown }).id;
    return typeof id === "string" && id.length > 0 ? id : null;
  }
  return null;
}

async function loadOrCreateInstallationId(): Promise<string> {
  const existing = await prisma.systemSetting.findUnique({
    where: { key: INSTALLATION_ID_KEY },
    select: { value: true },
  });
  const current = readId(existing?.value);
  if (current) return current;
  // `update: {}` keeps a value another request wrote first (create-once).
  const row = await prisma.systemSetting.upsert({
    where: { key: INSTALLATION_ID_KEY },
    create: { key: INSTALLATION_ID_KEY, value: randomUUID() },
    update: {},
    select: { value: true },
  });
  const id = readId(row.value);
  if (!id) throw new Error("Installation ID could not be stored");
  return id;
}

/** Per-request cached installation ID (created on first use). */
export const getInstallationId = cache(loadOrCreateInstallationId);
