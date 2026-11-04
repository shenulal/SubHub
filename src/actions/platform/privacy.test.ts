import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/service";
import { deleteObject, getSignedUrl, putObject } from "@/lib/services/storage";
import { getSettings } from "@/lib/settings/service";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listMyDataExports, requestDataExport } from "./privacy";
import { buildUserExportBundle } from "./privacy-bundle";

vi.mock("@/lib/db", () => ({
  prisma: {
    dataExportRequest: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  },
}));
vi.mock("@/lib/auth/require-auth", () => ({ getCachedSession: vi.fn() }));
vi.mock("@/lib/rbac/service", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/rbac/service")>(
      "@/lib/rbac/service"
    );
  return { ...actual, requirePermission: vi.fn() };
});
vi.mock("@/lib/settings/service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/settings/service")>(
    "@/lib/settings/service"
  );
  return { ...actual, getSettings: vi.fn() };
});
vi.mock("@/lib/services/storage", () => ({
  putObject: vi.fn(),
  getSignedUrl: vi.fn(),
  deleteObject: vi.fn(),
}));
vi.mock("./privacy-bundle", () => ({
  buildUserExportBundle: vi.fn(),
  EXPORT_CONTENT_TYPE: "application/zip",
  EXPORT_FORMAT: "ZIP",
}));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const ctx = { organizationId: "org-1", userId: "user-1" };

describe("requestDataExport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requirePermission).mockResolvedValue(ctx as never);
    vi.mocked(getSettings).mockResolvedValue({
      "privacy.dataExportExpiryHours": 48,
    } as never);
    vi.mocked(prisma.dataExportRequest.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.dataExportRequest.create).mockResolvedValue({
      id: "req-1",
    } as never);
  });

  it("builds the bundle, stores it under a tenant-scoped key and marks the request ready", async () => {
    vi.mocked(buildUserExportBundle).mockResolvedValue({
      zip: Buffer.from("zip"),
      fileCount: 5,
    });
    vi.mocked(putObject).mockResolvedValue({
      key: "org/org-1/exports/user-1/req-1.zip",
      sizeBytes: 3,
    });

    const result = await requestDataExport();

    expect(result).toMatchObject({ success: true, data: { id: "req-1" } });
    expect(requirePermission).toHaveBeenCalledWith("data:export_own");
    expect(putObject).toHaveBeenCalledWith(
      "org/org-1/exports/user-1/req-1.zip",
      expect.any(Buffer),
      "application/zip"
    );
    const update = vi.mocked(prisma.dataExportRequest.update).mock.calls[0][0]
      .data as Record<string, unknown>;
    expect(update.status).toBe("READY");
    expect(update.sizeBytes).toBe(3);
    const expires = update.expiresAt as Date;
    const completed = update.completedAt as Date;
    expect(expires.getTime() - completed.getTime()).toBe(48 * 3_600_000);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "REQUEST_DATA_EXPORT" }),
      })
    );
  });

  it("marks the request failed when the bundle cannot be built", async () => {
    vi.mocked(buildUserExportBundle).mockRejectedValue(new Error("boom"));
    const result = await requestDataExport();
    expect(result.success).toBe(false);
    expect(
      vi.mocked(prisma.dataExportRequest.update).mock.calls[0][0].data
    ).toMatchObject({ status: "FAILED", errorMessage: "boom" });
  });

  it("refuses a second concurrent export", async () => {
    vi.mocked(prisma.dataExportRequest.findFirst).mockResolvedValue({
      id: "pending",
    } as never);
    const result = await requestDataExport();
    expect(result.success).toBe(false);
    expect(prisma.dataExportRequest.create).not.toHaveBeenCalled();
  });
});

describe("listMyDataExports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requirePermission).mockResolvedValue(ctx as never);
    vi.mocked(getSignedUrl).mockResolvedValue("/api/files/x?sig=1");
  });

  it("signs download links for ready exports and lazily expires old ones", async () => {
    const future = new Date(Date.now() + 60_000);
    const past = new Date(Date.now() - 60_000);
    vi.mocked(prisma.dataExportRequest.findMany).mockResolvedValue([
      {
        id: "a",
        status: "READY",
        format: "ZIP",
        sizeBytes: 10,
        requestedAt: past,
        completedAt: past,
        expiresAt: future,
        storageKey: "k1",
        errorMessage: null,
      },
      {
        id: "b",
        status: "READY",
        format: "ZIP",
        sizeBytes: 10,
        requestedAt: past,
        completedAt: past,
        expiresAt: past,
        storageKey: "k2",
        errorMessage: null,
      },
    ] as never);

    const result = await listMyDataExports();

    expect(result.success).toBe(true);
    expect(result.data![0]).toMatchObject({
      id: "a",
      status: "READY",
      downloadUrl: "/api/files/x?sig=1",
    });
    expect(result.data![1]).toMatchObject({
      id: "b",
      status: "EXPIRED",
      downloadUrl: null,
    });
    expect(deleteObject).toHaveBeenCalledWith("k2");
    expect(prisma.dataExportRequest.update).toHaveBeenCalledWith({
      where: { id: "b" },
      data: { status: "EXPIRED", fileUrl: null },
    });
  });
});
