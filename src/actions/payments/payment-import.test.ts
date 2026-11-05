// src/actions/payments/payment-import.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock setup (declared before imports)
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    team: {
      findFirst: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
    app: {
      findMany: vi.fn(),
    },
    saaSCatalog: {
      findMany: vi.fn(),
    },
    merchantPattern: {
      findMany: vi.fn(),
    },
    paymentRecord: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/payment-csv", () => ({
  parsePaymentCSV: vi.fn(),
}));

vi.mock("@/lib/services/payment/process-payment-records", () => ({
  processPaymentRecords: vi.fn(),
}));

vi.mock("@/lib/services/payment/sync-history-service", () => ({
  createSyncHistory: vi.fn().mockResolvedValue({ id: "sync-history-csv-1" }),
  completeSyncHistory: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/services/saas-matcher", () => ({
  checkNonSaaSCache: vi.fn().mockResolvedValue(new Set()),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parsePaymentCSV } from "@/lib/payment-csv";
import { processPaymentRecords } from "@/lib/services/payment/process-payment-records";
import {
  completeSyncHistory,
  createSyncHistory,
} from "@/lib/services/payment/sync-history-service";
import { importPaymentCSV } from "./payment-import";

const mockSession = {
  user: {
    id: "user-1",
    organizationId: "org-1",
    role: "ADMIN",
  },
};

const mockParsedData = [
  {
    merchantName: "AWS",
    approvalNumber: "APPR001",
    amount: 10000,
    date: "2025-01-15",
  },
];

describe("importPaymentCSV", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(mockSession as never);
    vi.mocked(prisma.app.findMany).mockResolvedValue([]);
    vi.mocked(prisma.saaSCatalog.findMany).mockResolvedValue([]);
    vi.mocked(prisma.merchantPattern.findMany).mockResolvedValue([]);
    vi.mocked(prisma.paymentRecord.findMany).mockResolvedValue([]);
    vi.mocked(prisma.paymentRecord.createMany).mockResolvedValue({
      count: 1,
    } as never);
    vi.mocked(parsePaymentCSV).mockReturnValue({
      success: true,
      data: mockParsedData,
      errors: [],
    } as never);
    vi.mocked(processPaymentRecords).mockResolvedValue({
      paymentRecords: [{}],
      matchedCount: 1,
    } as never);
    vi.mocked(createSyncHistory).mockResolvedValue({
      id: "sync-history-csv-1",
    } as never);
    vi.mocked(completeSyncHistory).mockResolvedValue({} as never);
  });

  describe("authentication", () => {
    it("returns an authentication error without a session", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const result = await importPaymentCSV("csv-content");

      expect(result.success).toBe(false);
      expect(result.message).toBe("Authentication required");
    });

    it("returns a permission error for a non-ADMIN", async () => {
      vi.mocked(auth).mockResolvedValue({
        ...mockSession,
        user: { ...mockSession.user, role: "MEMBER" },
      } as never);

      const result = await importPaymentCSV("csv-content");

      expect(result.success).toBe(false);
      expect(result.message).toBe("Only admins can import payment records");
    });
  });

  describe("SyncHistory recording", () => {
    it("creates SyncHistory in RUNNING status when the import starts", async () => {
      await importPaymentCSV("csv-content");

      expect(createSyncHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org-1",
          type: "CSV_IMPORT",
          triggeredBy: "USER",
          userId: "user-1",
        })
      );
    });

    it("includes fileName in SyncHistory when the fileName option is given", async () => {
      await importPaymentCSV("csv-content", { fileName: "payments.csv" });

      expect(createSyncHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: "payments.csv",
        })
      );
    });

    it("calls completeSyncHistory with SUCCESS status on success", async () => {
      await importPaymentCSV("csv-content");

      expect(completeSyncHistory).toHaveBeenCalledWith(
        "sync-history-csv-1",
        expect.objectContaining({ status: "SUCCESS" })
      );
    });

    it("passes the correct counts to completeSyncHistory on success", async () => {
      vi.mocked(prisma.paymentRecord.createMany).mockResolvedValue({
        count: 1,
      } as never);
      vi.mocked(processPaymentRecords).mockResolvedValue({
        paymentRecords: [{}],
        matchedCount: 1,
      } as never);

      await importPaymentCSV("csv-content");

      expect(completeSyncHistory).toHaveBeenCalledWith(
        "sync-history-csv-1",
        expect.objectContaining({
          status: "SUCCESS",
          totalRecords: 1,
          successCount: 1,
          failedCount: 0,
          matchedCount: 1,
          unmatchedCount: 0,
        })
      );
    });

    it("calls completeSyncHistory with FAILED status on error", async () => {
      vi.mocked(prisma.paymentRecord.createMany).mockRejectedValue(
        new Error("DB save failed")
      );

      await importPaymentCSV("csv-content");

      expect(completeSyncHistory).toHaveBeenCalledWith(
        "sync-history-csv-1",
        expect.objectContaining({
          status: "FAILED",
          errorMessage: "DB save failed",
        })
      );
    });

    it("continues the main import flow even if createSyncHistory fails", async () => {
      vi.mocked(createSyncHistory).mockRejectedValue(
        new Error("SyncHistory DB error")
      );

      const result = await importPaymentCSV("csv-content");

      // The main import succeeds even if SyncHistory fails
      expect(result.success).toBe(true);
    });
  });

  describe("CSV parse error handling", () => {
    it("returns an error when CSV parsing fails", async () => {
      vi.mocked(parsePaymentCSV).mockReturnValue({
        success: false,
        error: "Invalid CSV format",
      } as never);

      const result = await importPaymentCSV("invalid-csv");

      expect(result.success).toBe(false);
      expect(result.message).toBe("Invalid CSV format");
    });

    it("returns an error when there is no data", async () => {
      vi.mocked(parsePaymentCSV).mockReturnValue({
        success: true,
        data: [],
      } as never);

      const result = await importPaymentCSV("empty-csv");

      expect(result.success).toBe(false);
      expect(result.message).toBe("No payment records to import");
    });
  });

  describe("successful import", () => {
    it("imports payment records successfully", async () => {
      const result = await importPaymentCSV("csv-content");

      expect(result.success).toBe(true);
      expect(result.data?.imported).toBe(1);
    });
  });
});
